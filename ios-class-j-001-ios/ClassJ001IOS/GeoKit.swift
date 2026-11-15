//
//  GeoKit.swift
//  ClassJ001IOS
//
//  Geometría para el análisis por departamento: carga del GeoJSON oficial
//  (GeoBoundaries ADM1 de Honduras), anillo exterior del polígono,
//  simplificación Douglas–Peucker y construcción de WKT para el
//  parámetro `intersectsWith` del ASF SearchAPI.
//

import Foundation

// MARK: - Modelo GeoJSON

struct Department: Identifiable, Hashable {
    let id: String          // shapeID
    let name: String        // shapeName
    let iso: String         // shapeISO
    /// Anillo exterior principal, simplificado, [[lon, lat], ...]
    let ring: [[Double]]
}

private struct FeatureCollection: Decodable {
    /// GeoJSON que admite "Polygon" (3 niveles) y "MultiPolygon" (4 niveles).
    struct Geometry: Decodable {
        var type: String
        var outerRings: [[[Double]]]

        enum CodingKeys: String, CodingKey { case type, coordinates }

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            type = try container.decode(String.self, forKey: .type)
            if let multi = try? container.decode([[[[Double]]]].self, forKey: .coordinates) {
                // MultiPolygon: [polígono][anillo][punto][2] — anillo exterior por polígono.
                outerRings = multi.compactMap { $0.first }
            } else if let poly = try? container.decode([[[Double]]].self, forKey: .coordinates) {
                // Polygon: [anillo][punto][2] — primer anillo = exterior.
                outerRings = poly.isEmpty ? [] : [poly[0]]
            } else {
                outerRings = []
            }
        }
    }
    struct Properties: Decodable {
        var shapeName: String
        var shapeISO: String?
        var shapeID: String
    }
    struct Feature: Decodable {
        var properties: Properties
        var geometry: Geometry
    }
    var features: [Feature]
}

/// GeoJSON simple de un solo polígono (contorno nacional, hnd.json).
private struct CountryCollection: Decodable {
    struct Geometry: Decodable {
        var type: String
        var coordinates: [[[Double]]]   // Polygon
    }
    struct Feature: Decodable {
        var geometry: Geometry
    }
    var features: [Feature]
}

// MARK: - Utilidades geográficas

enum GeoKit {

    /// Bounding box de Honduras.
    static let hondurasBbox = (
        minLon: -89.45, maxLon: -83.1, minLat: 12.9, maxLat: 16.55
    )

    /// Carga los 18 departamentos desde el GeoJSON emportado.
    static func loadDepartments() -> [Department] {
        guard
            let url = Bundle.main.url(
                forResource: "hnd-departments", withExtension: "json"
            ),
            let data = try? Data(contentsOf: url)
        else { return [] }

        guard let fc = try? JSONDecoder().decode(FeatureCollection.self, from: data) else {
            return []
        }

        return fc.features.compactMap { f in
            // Anillo exterior más grande (mayor área con signo) entre polígonos.
            guard let ring = f.geometry.outerRings
                .map({ (ring: $0, area: abs(signedArea($0))) })
                .max(by: { $0.area < $1.area })?.ring
            else { return nil }
            return Department(
                id: f.properties.shapeID,
                name: f.properties.shapeName,
                iso: f.properties.shapeISO ?? "",
                ring: simplify(ring, maxPoints: 120)
            )
        }
        .sorted { $0.name < $1.name }
    }

    /// Contorno nacional de Honduras (hnd.json, anillo exterior).
    static func loadCountryRing() -> [[Double]] {
        guard
            let url = Bundle.main.url(forResource: "hnd", withExtension: "json"),
            let data = try? Data(contentsOf: url),
            let fc = try? JSONDecoder().decode(CountryCollection.self, from: data),
            let ring = fc.features.first?.geometry.coordinates.first
        else { return [] }
        return ring
    }

    /// Área con signo del anillo (fórmula del zapatero).
    static func signedArea(_ ring: [[Double]]) -> Double {
        guard ring.count > 2 else { return 0 }
        var sum = 0.0
        for i in 0 ..< ring.count {
            let a = ring[i]
            let b = ring[(i + 1) % ring.count]
            sum += (a[0] * b[1]) - (b[0] * a[1])
        }
        return sum / 2
    }

    /// Douglas–Peucker simple, acotado a `maxPoints`.
    static func simplify(_ points: [[Double]], tolerance: Double = 0.02, maxPoints: Int = 120) -> [[Double]] {
        guard points.count > 2 else { return points }
        var tol = tolerance
        var simplified = douglasPeucker(points, tolerance: tol)
        while simplified.count > maxPoints {
            tol *= 2
            simplified = douglasPeucker(points, tolerance: tol)
        }
        return simplified
    }

    private static func douglasPeucker(_ points: [[Double]], tolerance: Double) -> [[Double]] {
        guard points.count > 2 else { return points }
        var keep = [Bool](repeating: false, count: points.count)
        keep[0] = true
        keep[points.count - 1] = true

        var stack: [(Int, Int)] = [(0, points.count - 1)]
        while let (start, end) = stack.popLast() {
            guard end > start + 1 else { continue }
            var maxDist = 0.0
            var maxIdx = start
            for i in (start + 1) ..< end {
                let d = pointToSegment(points[i], points[start], points[end])
                if d > maxDist {
                    maxDist = d
                    maxIdx = i
                }
            }
            if maxDist > tolerance {
                keep[maxIdx] = true
                stack.append((start, maxIdx))
                stack.append((maxIdx, end))
            }
        }
        return zip(keep, points).filter { $0.0 }.map { $0.1 }
    }

    private static func pointToSegment(_ p: [Double], _ a: [Double], _ b: [Double]) -> Double {
        let (px, py) = (p[0], p[1])
        let (ax, ay) = (a[0], a[1])
        let (bx, by) = (b[0], b[1])
        let dx = bx - ax
        let dy = by - ay
        let len2 = dx * dx + dy * dy
        if len2 == 0 { return hypot(px - ax, py - ay) }
        let t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
        let cx = ax + t * dx
        let cy = ay + t * dy
        return hypot(px - cx, py - cy)
    }

    /// WKT POLYGON((lon lat, lon lat, ...)) cerrado, listo para `intersectsWith`.
    static func wktPolygon(_ ring: [[Double]]) -> String {
        var closed = ring
        if let first = ring.first, let last = ring.last, first != last {
            closed.append(first)
        }
        let coords = closed
            .map { "\(String(format: "%.6f", $0[0])) \(String(format: "%.6f", $0[1]))" }
            .joined(separator: ", ")
        return "POLYGON((\(coords)))"
    }

    /// Bounding box de un anillo.
    static func bbox(_ ring: [[Double]]) -> (minLon: Double, maxLon: Double, minLat: Double, maxLat: Double) {
        let lons = ring.map { $0[0] }
        let lats = ring.map { $0[1] }
        return (lons.min() ?? 0, lons.max() ?? 0, lats.min() ?? 0, lats.max() ?? 0)
    }
}
