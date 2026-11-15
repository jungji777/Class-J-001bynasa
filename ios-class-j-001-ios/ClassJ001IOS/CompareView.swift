//
//  CompareView.swift
//  ClassJ001IOS
//
//  Comparador A/B de dos adquisiciones reales: quicklooks LATLON lado a
//  lado y días de separación. Comparación visual, no radiométrica.
//

import SwiftUI

struct CompareView: View {
    @State private var granules: [NisarGranule] = []
    @State private var isLoading = false
    @State private var error: String?
    @State private var sideA: NisarGranule?
    @State private var sideB: NisarGranule?

    var body: some View {
        Group {
            if isLoading && granules.isEmpty {
                ProgressView("Consultando ASF SearchAPI…")
                    .tint(Theme.primary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error, granules.isEmpty {
                ContentUnavailableView {
                    Label("Sin conexión con ASF", systemImage: "wifi.exclamationmark")
                } description: {
                    Text(error)
                } actions: {
                    Button("Reintentar") { Task { await reload() } }
                        .buttonStyle(.borderedProminent)
                        .tint(Theme.primary)
                }
            } else {
                compareContent
            }
        }
        .background(Theme.background)
        .navigationTitle("Comparar")
        .task { await reload() }
    }

    private var compareContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let a = sideA, let b = sideB, a != b {
                    HStack {
                        Text("Δ \(ASFClient.daysBetween(a, b)) días entre adquisiciones")
                            .font(.subheadline.weight(.semibold))
                            .monospacedDigit()
                        Spacer()
                        Label("Visual, no radiométrica", systemImage: "info.circle")
                            .font(.caption2)
                            .foregroundStyle(Theme.muted)
                    }

                    HStack(alignment: .top, spacing: 12) {
                        ComparePane(granule: a, tag: "A", tint: Theme.primary, options: granules, selection: Binding(get: { sideA }, set: { sideA = $0 }))
                        ComparePane(granule: b, tag: "B", tint: Theme.warning, options: granules, selection: Binding(get: { sideB }, set: { sideB = $0 }))
                    }
                } else {
                    ContentUnavailableView(
                        "Elige dos adquisiciones distintas",
                        systemImage: "square.split.2x1",
                        description: Text("Selecciona una adquisición en cada lado para comparar quicklooks oficiales.")
                    )
                    .foregroundStyle(Theme.muted)
                }

                Text("Fuente: quicklooks LATLON oficiales del ASF DAAC. La diferencia entre fechas es visual; el análisis radiométrico requiere los productos HDF5.")
                    .font(.caption2)
                    .foregroundStyle(Theme.muted)
            }
            .padding(16)
        }
    }

    private func reload() async {
        isLoading = true
        error = nil
        do {
            granules = try await ASFClient.searchNisar(
                lon: ASFClient.hondurasPoint.lon,
                lat: ASFClient.hondurasPoint.lat,
                maxResults: 30
            )
            sideA = granules.first
            sideB = granules.dropFirst().first
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

private struct ComparePane: View {
    let granule: NisarGranule
    let tag: String
    let tint: Color
    let options: [NisarGranule]
    @Binding var selection: NisarGranule?
    @State private var showFull = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Menu {
                ForEach(options) { g in
                    Button(ASFClient.formatDate(g.stopTime)) { selection = g }
                }
            } label: {
                HStack(spacing: 6) {
                    Text(tag)
                        .font(.caption.weight(.bold))
                        .foregroundStyle(tint)
                    Text(ASFClient.formatDate(granule.stopTime))
                        .font(.caption.weight(.semibold))
                        .monospacedDigit()
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.caption2)
                        .foregroundStyle(Theme.muted)
                }
            }

            Color(Theme.panel)
                .aspectRatio(1, contentMode: .fit)
                .overlay {
                    if let urlString = granule.browse.latlon, let url = URL(string: urlString) {
                        AsyncImage(url: url) { phase in
                            if let image = phase.image {
                                image.resizable().aspectRatio(contentMode: .fit)
                            } else {
                                ProgressView().tint(Theme.primary)
                            }
                        }
                        .allowsHitTesting(false)
                    }
                }
                .clipShape(.rect(cornerRadius: 12))
                .overlay {
                    RoundedRectangle(cornerRadius: 12)
                        .strokeBorder(tint.opacity(0.5), lineWidth: 1.5)
                }
                .overlay(alignment: .bottomTrailing) {
                    Image(systemName: "arrow.up.left.and.arrow.down.right")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Theme.foreground)
                        .padding(6)
                        .orbitalGlass(cornerRadius: 10)
                        .padding(8)
                }
                .onTapGesture { showFull = true }
        }
        .fullScreenCover(isPresented: $showFull) {
            ZoomableQuicklook(
                url: granule.browse.latlon.flatMap(URL.init(string:)),
                caption: "Lado \(tag) · \(ASFClient.formatDate(granule.stopTime))"
            )
        }
    }
}
