//
//  ASFClient.swift
//  ClassJ001IOS
//
//  Cliente del ASF SearchAPI (NASA ASF DAAC) para adquisiciones NISAR reales.
//  Puerto del cliente web (web-terranisar/src/lib/asf/client.ts).
//
//  Endpoint público, sin autenticación para búsqueda y metadatos:
//    https://api.daac.asf.alaska.edu/services/search/param
//  Documentación: https://docs.asf.alaska.edu/api/basics/
//
//  Los PNG de browse (quicklooks) en nisar.asf.earthdatacloud.nasa.gov son
//  públicos; los productos HDF5/GeoTIFF completos requieren cuenta gratuita
//  de NASA Earthdata (ver SourcesView y docs/DATA_SOURCES.md de la web).
//

import Foundation

// MARK: - Modelos

struct NisarPolBrowse: Identifiable, Hashable {
    let key: String
    let url: String
    let label: String
    var id: String { key }
}

struct NisarBrowse: Hashable {
    /// Imagen geocodificada (plate carrée, cubre el footprint).
    var latlon: String?
    var thumbnail: String?
    /// Quicklook de geometría nativa (producto compuesto).
    var native: String?
    /// Quicklooks oficiales por polarización (banda A/B · HHHH/HVHV).
    var pols: [NisarPolBrowse]

    /// Todas las vistas oficiales disponibles, en orden estable.
    var allViews: [(key: String, label: String, url: String?)] {
        var views: [(String, String, String?)] = [
            ("latlon", "LATLON", latlon),
            ("native", "Nativa", native),
        ]
        views.append(contentsOf: pols.map { ($0.key, $0.label, $0.url) })
        return views.filter { $0.2 != nil }
    }
}

struct NisarGranule: Identifiable, Hashable {
    let fileID: String
    let sceneName: String
    let processingLevel: String
    /// Inicio de adquisición (ISO UTC).
    let startTime: String
    /// Fin de adquisición (ISO UTC).
    let stopTime: String
    let flightDirection: String
    let pathNumber: Int
    let frameNumber: Int
    let processingDate: String?
    /// URL del producto HDF5 en ASF Earthdata Cloud.
    let url: String
    let browse: NisarBrowse
    /// Polígono del footprint [[lon, lat], ...].
    let footprint: [[Double]]
    let bytesH5: Int?

    var id: String { fileID }

    var isAscending: Bool { flightDirection == "ASCENDING" }
}

// MARK: - Decodificación ASF GeoJSON

struct AsfFeature: Decodable {
    struct Geometry: Decodable {
        var coordinates: [[[Double]]]
    }
    struct Bytes: Decodable {
        var bytes: Int
        var format: String
    }
    struct Properties: Decodable {
        var fileID: String
        var sceneName: String
        var processingLevel: String
        var startTime: String
        var stopTime: String
        var flightDirection: String
        var pathNumber: Int
        var frameNumber: Int
        var processingDate: String?
        var url: String
        var browse: [String]?
        var bytes: [String: Bytes]?
    }

    var geometry: Geometry
    var properties: Properties
}

struct AsfResponse: Decodable {
    var features: [AsfFeature]?
}

// MARK: - Errores

enum ASFFetchError: LocalizedError {
    case badURL
    case http(Int)
    case empty

    var errorDescription: String? {
        switch self {
        case .badURL: return "No se pudo construir la consulta al ASF SearchAPI."
        case .http(let code): return "ASF SearchAPI respondió \(code)."
        case .empty: return "El ASF SearchAPI no devolvió resultados."
        }
    }
}

// MARK: - Cliente

enum ASFClient {
    static let searchEndpoint = URL(string: "https://api.daac.asf.alaska.edu/services/search/param")!

    /// Punto de referencia: centro de Honduras.
    static let hondurasPoint = (lon: -86.6, lat: 14.85)

    static func parseBrowse(_ urls: [String]) -> NisarBrowse {
        let isThumb = { (u: String) in u.contains("_thumbnail") }
        let latlon = urls.first { $0.contains("_LATLON.png") && !isThumb($0) }
        let thumbnail = urls.first { $0.contains("_LATLON_thumbnail") }
        let native = urls.first { u in
            u.range(of: #"_NATIVE(_A)?\.png$"#, options: .regularExpression) != nil
        }
        let polRe = try! NSRegularExpression(pattern: #"_NATIVE_([AB])_(HHHH|HVHV)\.png$"#)
        let pols: [NisarPolBrowse] = urls.compactMap { u in
            guard
                let m = polRe.firstMatch(
                    in: u, range: NSRange(u.startIndex..., in: u)
                )
            else { return nil }
            let band = String(u[Range(m.range(at: 1), in: u)!])
            let polCode = String(u[Range(m.range(at: 2), in: u)!])
            let pol = polCode == "HHHH" ? "HH · co-polarizada" : "HV · cruz-polarizada"
            return NisarPolBrowse(
                key: "pol-\(band)-\(polCode)",
                url: u,
                label: "Banda \(band) · \(pol)"
            )
        }
        return NisarBrowse(latlon: latlon, thumbnail: thumbnail, native: native, pols: pols)
    }

    static func toGranule(_ f: AsfFeature) -> NisarGranule {
        let p = f.properties
        let h5 = p.bytes?.values.first { $0.format == "HDF5" }
        return NisarGranule(
            fileID: p.fileID,
            sceneName: p.sceneName,
            processingLevel: p.processingLevel,
            startTime: p.startTime,
            stopTime: p.stopTime,
            flightDirection: p.flightDirection == "ASCENDING" ? "ASCENDING" : "DESCENDING",
            pathNumber: p.pathNumber,
            frameNumber: p.frameNumber,
            processingDate: p.processingDate,
            url: p.url,
            browse: parseBrowse(p.browse ?? []),
            footprint: f.geometry.coordinates.first ?? [],
            bytesH5: h5?.bytes
        )
    }

    /// Busca adquisiciones NISAR que cubran un punto o área, ordenadas por fecha desc.
    static func searchNisar(
        lon: Double? = nil,
        lat: Double? = nil,
        areaWkt: String? = nil,
        processingLevels: [String] = ["GCOV"],
        maxResults: Int = 30
    ) async throws -> [NisarGranule] {
        let intersectsWith = areaWkt ?? "POINT(\(lon ?? 0) \(lat ?? 0))"
        guard
            var comps = URLComponents(
                url: searchEndpoint, resolvingAgainstBaseURL: false
            )
        else { throw ASFFetchError.badURL }
        comps.queryItems = [
            URLQueryItem(name: "dataset", value: "NISAR"),
            URLQueryItem(name: "processingLevel", value: processingLevels.joined(separator: ",")),
            URLQueryItem(name: "intersectsWith", value: intersectsWith),
            URLQueryItem(name: "maxResults", value: String(maxResults)),
            URLQueryItem(name: "output", value: "geojson"),
        ]
        guard let url = comps.url else { throw ASFFetchError.badURL }

        var request = URLRequest(url: url)
        request.setValue("application/geo+json", forHTTPHeaderField: "Accept")
        request.timeoutInterval = 45

        let (data, response) = try await URLSession.shared.data(for: request)
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            throw ASFFetchError.http(http.statusCode)
        }

        let decoded = try JSONDecoder().decode(AsfResponse.self, from: data)
        let granules = (decoded.features ?? []).map(toGranule)
            .sorted { date($0.stopTime) > date($1.stopTime) }
        return granules
    }

    static func date(_ iso: String) -> Date {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ssZ"
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter.date(from: iso) ?? .distantPast
    }

    /// Días de separación entre dos adquisiciones.
    static func daysBetween(_ a: NisarGranule, _ b: NisarGranule) -> Int {
        Int(abs(date(b.stopTime).timeIntervalSince(date(a.stopTime)) / 86_400))
    }

    // MARK: Formatos (es-HN, UTC)

    static let displayDate: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "es_HN")
        f.dateFormat = "d MMM yyyy"
        f.timeZone = TimeZone(identifier: "UTC")
        return f
    }()

    static let displayTime: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "es_HN")
        f.dateFormat = "HH:mm"
        f.timeZone = TimeZone(identifier: "UTC")
        return f
    }()

    static func formatDate(_ iso: String) -> String {
        displayDate.string(from: date(iso))
    }

    static func formatTime(_ iso: String) -> String {
        "\(displayTime.string(from: date(iso))) UTC"
    }

    /// Tamaño legible ("7.1 GB").
    static func formatBytes(_ bytes: Int?) -> String? {
        guard let bytes else { return nil }
        let gb = Double(bytes) / 1_000_000_000
        if gb >= 1 {
            return String(format: "%.1f GB", gb)
        }
        return String(format: "%.0f MB", Double(bytes) / 1_000_000)
    }
}
