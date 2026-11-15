//
//  GlobeSceneView.swift
//  ClassJ001IOS
//
//  Globo nocturno 3D con SceneKit, replicando las funciones del globo web:
//  capas (límite de Honduras, luces nocturnas, retícula), arrastre, zoom,
//  vuelo animado a un punto (lat, lon) y coordenadas del punto central.
//
//  Modelo: la cámara orbita una esfera fija. El estado (lat, lon, distancia)
//  define exactamente el punto que mira al espectador, así que las
//  coordenadas y el vuelo son consistentes por construcción. La constante
//  `textureLonOffset` calibra el mapeo de la textura equirectangular de
//  SCNSphere (verificada contra captura de simulador).
//

import SwiftUI
import SceneKit

enum GlobeLayer: String, CaseIterable, Identifiable {
    case border, lights, graticule
    var id: String { rawValue }

    var label: String {
        switch self {
        case .border: return "Límite de Honduras"
        case .lights: return "Luces nocturnas"
        case .graticule: return "Retícula geográfica"
        }
    }

    var hint: String {
        switch self {
        case .border: return "Contorno del territorio en seguimiento"
        case .lights: return "Base VIIRS sobre textura nocturna"
        case .graticule: return "Paralelos y meridianos cada 15°"
        }
    }
}

struct GlobeSite: Identifiable, Hashable {
    let id: String
    let name: String
    let note: String
    let lat: Double
    let lon: Double
}

/// Lugares de referencia (iguales a HONDURAN_SITES de la web).
enum GlobeSites {
    static let all: [GlobeSite] = [
        .init(id: "tegucigalpa", name: "Tegucigalpa", note: "Capital · distrito central", lat: 14.0723, lon: -87.1921),
        .init(id: "mosquitia", name: "La Mosquitia", note: "Frente de deforestación", lat: 15.1500, lon: -84.9167),
        .init(id: "yojoa", name: "Lago de Yojoa", note: "Humedal y agricultura", lat: 15.0333, lon: -87.7500),
        .init(id: "sula", name: "Valle de Sula", note: "Corredor urbano e inundaciones", lat: 15.4667, lon: -87.9833),
        .init(id: "copan", name: "Copán", note: "Sitio arqueológico y bosque seco", lat: 14.8333, lon: -89.1500),
    ]
}

struct GlobeSceneView: UIViewRepresentable {
    var layers: Set<GlobeLayer>
    var flyTo: GlobeSite?
    /// Pulso de zoom: >0 acerca, <0 aleja (como zoomBy de la web).
    var zoomPulse: Int
    /// Coordenadas del punto central visible.
    var onCenterCoords: ((Double, Double) -> Void)?

    static func formatCoords(lat: Double, lon: Double) -> String {
        let latHem = lat >= 0 ? "N" : "S"
        let lonHem = lon >= 0 ? "E" : "O"
        return String(format: "%.4f° %@ · %.4f° %@", abs(lat), latHem, abs(lon), lonHem)
    }

    func makeUIView(context: Context) -> SCNView {
        let view = SCNView()
        view.scene = context.coordinator.scene
        view.backgroundColor = UIColor(Theme.background)
        view.antialiasingMode = .multisampling2X
        view.preferredFramesPerSecond = 60

        context.coordinator.onCenterCoords = onCenterCoords

        let pan = UIPanGestureRecognizer(
            target: context.coordinator, action: #selector(Coordinator.handlePan(_:))
        )
        view.addGestureRecognizer(pan)
        let pinch = UIPinchGestureRecognizer(
            target: context.coordinator, action: #selector(Coordinator.handlePinch(_:))
        )
        view.addGestureRecognizer(pinch)

        context.coordinator.apply(layers: layers)
        context.coordinator.updateCamera()
        return view
    }

    func updateUIView(_ view: SCNView, context: Context) {
        context.coordinator.onCenterCoords = onCenterCoords
        context.coordinator.apply(layers: layers)

        if let site = flyTo, site != context.coordinator.lastSite {
            context.coordinator.lastSite = site
            context.coordinator.flyTo(site)
        }
        if zoomPulse != context.coordinator.lastZoomPulse {
            let delta = zoomPulse - context.coordinator.lastZoomPulse
            context.coordinator.lastZoomPulse = zoomPulse
            context.coordinator.zoom(by: delta > 0 ? 0.72 : 1.38)
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    // MARK: Coordinator

    @MainActor
    final class Coordinator {
        let scene: SCNScene
        let globeNode: SCNNode
        let borderNode: SCNNode
        let graticuleNode: SCNNode
        let cameraNode: SCNNode
        let sphereMaterial: SCNMaterial

        var lastSite: GlobeSite?
        var lastZoomPulse = 0
        var onCenterCoords: ((Double, Double) -> Void)?

        private var camLat: Double = 14.85
        private var camLon: Double = -86.6
        private var distance: Float = 3.1

        /// Calibración del mapeo de textura de SCNSphere (equirectangular).
        static let textureLonOffset: Double = 0.0

        init() {
            scene = SCNScene()
            scene.background.contents = UIColor(Theme.background)

            // Esfera emisiva: la Tierra de noche, tal cual la textura.
            let sphere = SCNSphere(radius: 1)
            sphere.segmentCount = 128
            sphereMaterial = SCNMaterial()
            sphereMaterial.lightingModel = .constant
            sphereMaterial.diffuse.contents = UIImage(named: "EarthNight")
            sphereMaterial.emission.contents = UIImage(named: "EarthNight")
            sphereMaterial.emission.intensity = 1.0
            sphere.materials = [sphereMaterial]
            globeNode = SCNNode(geometry: sphere)
            scene.rootNode.addChildNode(globeNode)

            // Halo atmosférico sutil.
            let halo = SCNSphere(radius: 1.045)
            let haloMaterial = SCNMaterial()
            haloMaterial.lightingModel = .constant
            haloMaterial.transparent.contents = UIColor(Theme.primary).withAlphaComponent(0.055)
            halo.materials = [haloMaterial]
            scene.rootNode.addChildNode(SCNNode(geometry: halo))

            // Capas de líneas.
            borderNode = Self.lineNode(
                points: Self.sphereRing(GeoKit.loadCountryRing(), radius: 1.006),
                color: UIColor(Theme.primary)
            )
            scene.rootNode.addChildNode(borderNode)

            graticuleNode = Self.graticuleNode(radius: 1.004)
            scene.rootNode.addChildNode(graticuleNode)

            cameraNode = SCNNode()
            let camera = SCNCamera()
            camera.fieldOfView = 38
            cameraNode.camera = camera
            scene.rootNode.addChildNode(cameraNode)
        }

        // MARK: Geometría esférica

        /// Dirección unitaria de (lat, lon) en la esfera.
        static func direction(lat: Double, lon: Double) -> SCNVector3 {
            let latR = (lat * .pi) / 180
            let lonR = ((lon + textureLonOffset) * .pi) / 180
            return SCNVector3(
                Float(cos(latR) * sin(lonR)),
                Float(sin(latR)),
                Float(cos(latR) * cos(lonR))
            )
        }

        private static func sphereRing(_ ring: [[Double]], radius: Float) -> [SCNVector3] {
            var pts = ring.map { pt -> SCNVector3 in
                var v = direction(lat: pt[1], lon: pt[0])
                v.x *= radius
                v.y *= radius
                v.z *= radius
                return v
            }
            if
                let first = pts.first, let last = pts.last,
                first.x != last.x || first.y != last.y || first.z != last.z
            {
                pts.append(first)
            }
            return pts
        }

        private static func lineNode(points: [SCNVector3], color: UIColor) -> SCNNode {
            guard points.count > 1 else { return SCNNode() }
            let source = SCNGeometrySource(vertices: points)
            let indices: [Int32] = (0 ..< Int32(points.count - 1)).flatMap { [$0, $0 + 1] }
            let element = SCNGeometryElement(indices: indices, primitiveType: .line)
            let geometry = SCNGeometry(sources: [source], elements: [element])
            let material = SCNMaterial()
            material.lightingModel = .constant
            material.diffuse.contents = color
            geometry.materials = [material]
            return SCNNode(geometry: geometry)
        }

        private static func graticuleNode(radius: Float) -> SCNNode {
            let parent = SCNNode()
            // Paralelos cada 15°
            for lat in stride(from: -75.0, through: 75.0, by: 15.0) {
                var ring: [[Double]] = []
                for lon in stride(from: -180.0, through: 180.0, by: 5.0) {
                    ring.append([lon, lat])
                }
                let node = lineNode(
                    points: sphereRing(ring, radius: radius),
                    color: UIColor.white.withAlphaComponent(0.09)
                )
                parent.addChildNode(node)
            }
            // Meridianos cada 15°
            for lon in stride(from: -180.0, to: 180.0, by: 15.0) {
                var ring: [[Double]] = []
                for lat in stride(from: -90.0, through: 90.0, by: 5.0) {
                    ring.append([lon, lat])
                }
                let node = lineNode(
                    points: sphereRing(ring, radius: radius),
                    color: UIColor.white.withAlphaComponent(0.09)
                )
                parent.addChildNode(node)
            }
            return parent
        }

        // MARK: Estado

        func apply(layers: Set<GlobeLayer>) {
            borderNode.isHidden = !layers.contains(.border)
            graticuleNode.isHidden = !layers.contains(.graticule)
            sphereMaterial.emission.intensity = layers.contains(.lights) ? 1.0 : 0.3
        }

        func updateCamera() {
            let dir = Self.direction(lat: camLat, lon: camLon)
            cameraNode.position = SCNVector3(dir.x * distance, dir.y * distance, dir.z * distance)
            cameraNode.look(at: SCNVector3(0, 0, 0), up: SCNVector3(0, 1, 0), localFront: SCNVector3(0, 0, -1))
            onCenterCoords?(camLat, camLon)
        }

        func flyTo(_ site: GlobeSite) {
            let startLat = camLat
            let startLon = camLon
            // Arco más corto en longitud.
            var diff = (site.lon - startLon + 540)
                .truncatingRemainder(dividingBy: 360) - 180
            if diff == -180 { diff = 180 }
            let targetLon = startLon + diff
            let endLat = max(-85.0, min(85.0, site.lat))

            let action = SCNAction.customAction(duration: 1.2) { [weak self] _, elapsed in
                guard let self else { return }
                let t = Float(min(elapsed / 1.2, 1))
                let s = t * t * (3 - 2 * t) // smoothstep
                self.camLat = startLat + (endLat - startLat) * Double(s)
                self.camLon = startLon + (targetLon - startLon) * Double(s)
                self.updateCamera()
            }
            cameraNode.runAction(action)
        }

        func zoom(by factor: Float) {
            distance = max(1.8, min(5.2, distance * factor))
            updateCamera()
        }

        // MARK: Gestos

        @objc func handlePan(_ gesture: UIPanGestureRecognizer) {
            let translation = gesture.translation(in: gesture.view)
            let scale: Double = 0.22
            // Arrastrar el contenido: el centro se mueve en contra del dedo.
            camLon -= Double(translation.x) * scale * Double(distance / 3.1)
            camLat += Double(translation.y) * scale * Double(distance / 3.1)
            camLat = max(-85.0, min(85.0, camLat))
            camLon = ((camLon + 180).truncatingRemainder(dividingBy: 360) + 360)
                .truncatingRemainder(dividingBy: 360) - 180
            gesture.setTranslation(.zero, in: gesture.view)
            updateCamera()
        }

        @objc func handlePinch(_ gesture: UIPinchGestureRecognizer) {
            distance = max(1.8, min(5.2, distance / Float(gesture.scale)))
            gesture.scale = 1
            updateCamera()
        }
    }
}
