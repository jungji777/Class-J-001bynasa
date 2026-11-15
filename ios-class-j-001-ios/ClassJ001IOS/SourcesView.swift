//
//  SourcesView.swift
//  ClassJ001IOS
//
//  Fuentes de datos citadas — nada inventado.
//

import SwiftUI

private struct Source: Identifiable {
    let id = UUID()
    let name: String
    let role: String
    let url: String
}

struct SourcesView: View {
    private let sources: [Source] = [
        .init(
            name: "ASF SearchAPI (NASA ASF DAAC)",
            role: "Metadatos y footprint de adquisiciones NISAR reales. Endpoint público, sin credenciales para búsqueda.",
            url: "https://docs.asf.alaska.edu/api/basics/"
        ),
        .init(
            name: "ASF Vertex / NASA Earthdata",
            role: "Productos completos (HDF5 ~7 GB, 10–20 m/píxel). Requieren cuenta gratuita de Earthdata Login.",
            url: "https://urs.earthdata.nasa.gov/"
        ),
        .init(
            name: "Quicklooks oficiales NISAR",
            role: "PNG de browse (LATLON 2007×1973 px, NATIVE, polarizaciones HH/HV) distribuidos en ASF Earthdata Cloud. Máximo raster oficial como imagen.",
            url: "https://search.asf.alaska.edu/"
        ),
        .init(
            name: "Misión NISAR (NASA · ISRO)",
            role: "Radar de banda L y S para observación de cambios terrestres.",
            url: "https://nisar.jpl.nasa.gov/"
        ),
        .init(
            name: "Textura nocturna VIIRS/Black Marble",
            role: "Base de la esfera del globo en la portada (proveniente de la textura earth-night de la web Class J-001).",
            url: "https://earthobservatory.nasa.gov/features/NightLights"
        ),
        .init(
            name: "GeoBoundaries ADM1 · Honduras",
            role: "Contornos oficiales de los 18 departamentos (shapeID/shapeName), simplificados a ≤120 vértices para el análisis.",
            url: "https://www.geoboundaries.org/"
        ),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                ForEach(sources) { source in
                    Link(destination: URL(string: source.url)!) {
                        VStack(alignment: .leading, spacing: 5) {
                            HStack {
                                Text(source.name)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(Theme.foreground)
                                Spacer()
                                Image(systemName: "arrow.up.right")
                                    .font(.caption)
                                    .foregroundStyle(Theme.primary)
                            }
                            Text(source.role)
                                .font(.caption)
                                .foregroundStyle(Theme.muted)
                        }
                        .padding(14)
                        .orbitalGlass(cornerRadius: 16)
                    }
                    .buttonStyle(.plain)
                }

                Text("Regla del proyecto: datos reales en vivo o mensaje honesto de falta de cobertura. Nada inventado.")
                    .font(.caption2)
                    .foregroundStyle(Theme.muted)
            }
            .padding(16)
        }
        .background(Theme.background)
        .navigationTitle("Fuentes")
    }
}
