//
//  HomeView.swift
//  ClassJ001IOS
//
//  Portada: globo nocturno 3D con chrome de Liquid Glass flotante.
//  Replica las funciones de la portada web: búsqueda de lugares o
//  coordenadas con vuelo, capas del globo, zoom, y coordenadas del punto
//  central visibles en vivo.
//

import SwiftUI

struct HomeView: View {
    @Binding var selection: AppTab

    @State private var search = ""
    @State private var layers: Set<GlobeLayer> = [.border, .lights]
    @State private var flyTo: GlobeSite?
    @State private var zoomPulse = 0
    @State private var centerCoords: String?
    @State private var toast: Toast?

    var body: some View {
        ZStack {
            GlobeSceneView(
                layers: layers,
                flyTo: flyTo,
                zoomPulse: zoomPulse,
                onCenterCoords: { lat, lon in
                    centerCoords = GlobeSceneView.formatCoords(lat: lat, lon: lon)
                }
            )
            .ignoresSafeArea()

            VStack {
                // Chrome superior: marca + buscador + capas
                HStack(alignment: .top, spacing: 10) {
                    brandChip
                    searchField
                    layersMenu
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)

                Spacer()

                // Chip de coordenadas del punto central (como el CursorChip web)
                if let centerCoords {
                    HStack(spacing: 6) {
                        Circle()
                            .fill(Theme.primary)
                            .frame(width: 6, height: 6)
                        Text(centerCoords)
                            .font(.caption2)
                            .monospacedDigit()
                            .foregroundStyle(Theme.foreground)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .orbitalGlass(cornerRadius: 12)
                    .padding(.bottom, 10)
                    .transition(.opacity)
                }

                // Sitios de referencia (vuelo del globo)
                ScrollView(.horizontal, showsIndicators: false) {
                    GlassGroup(spacing: 10) {
                        HStack(spacing: 8) {
                            ForEach(GlobeSites.all) { site in
                                siteChip(site)
                            }
                        }
                    }
                }
                .contentMargins(.horizontal, 16)

                HStack(alignment: .bottom) {
                    territoryCard
                        .frame(maxWidth: 320)
                    Spacer()
                    zoomControls
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 12)
            }

            if let toast {
                ToastView(toast: toast)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .preferredColorScheme(.dark)
        .animation(.snappy(duration: 0.3), value: toast)
        .animation(.snappy(duration: 0.25), value: centerCoords == nil)
    }

    // MARK: Subvistas

    private var brandChip: some View {
        HStack(spacing: 10) {
            Image(systemName: "globe.americas.fill")
                .font(.title3)
                .foregroundStyle(Theme.primary)
            VStack(alignment: .leading, spacing: 1) {
                Text("Class J-001")
                    .font(.headline.weight(.bold))
                Text("NASA · ISRO · SAR")
                    .font(.caption2)
                    .foregroundStyle(Theme.muted)
                    .kerning(1.4)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .orbitalGlass()
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.subheadline)
                .foregroundStyle(Theme.muted)
            TextField("Lugar o coordenadas (14.07, -87.19)", text: $search)
                .font(.footnote)
                .foregroundStyle(Theme.foreground)
                .onSubmit(handleSearch)
            if !search.isEmpty {
                Button {
                    search = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.subheadline)
                        .foregroundStyle(Theme.muted)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .orbitalGlass(cornerRadius: 20)
    }

    private var layersMenu: some View {
        Menu {
            ForEach(GlobeLayer.allCases) { layer in
                Button {
                    if layers.contains(layer) {
                        layers.remove(layer)
                    } else {
                        layers.insert(layer)
                    }
                    UISelectionFeedbackGenerator().selectionChanged()
                } label: {
                    Label(
                        layer.label,
                        systemImage: layers.contains(layer) ? "checkmark" : "circle"
                    )
                }
            }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "square.2.layers.3d")
                    .font(.subheadline)
                    .foregroundStyle(Theme.primary)
                Image(systemName: "chevron.down")
                    .font(.caption2)
                    .foregroundStyle(Theme.muted)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 12)
        }
        .orbitalGlass(cornerRadius: 20)
    }

    private func siteChip(_ site: GlobeSite) -> some View {
        Button {
            flyTo = site
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        } label: {
            VStack(alignment: .leading, spacing: 1) {
                Text(site.name)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Theme.foreground)
                Text(site.note)
                    .font(.caption2)
                    .foregroundStyle(Theme.muted)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
        }
        .orbitalGlass(cornerRadius: 14, interactive: true)
    }

    private var zoomControls: some View {
        VStack(spacing: 0) {
            Button {
                zoomPulse += 1
            } label: {
                Image(systemName: "plus")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(Theme.foreground)
                    .frame(width: 40, height: 40)
            }
            .buttonStyle(.plain)
            Divider()
                .background(.white.opacity(0.1))
            Button {
                zoomPulse -= 1
            } label: {
                Image(systemName: "minus")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(Theme.foreground)
                    .frame(width: 40, height: 40)
            }
            .buttonStyle(.plain)
        }
        .orbitalGlass(cornerRadius: 14)
    }

    private var territoryCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("Territorio", systemImage: "mappin.and.ellipse")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.muted)
                    .textCase(.uppercase)
                    .kerning(1.2)
                Spacer()
                Text("Activa")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(Theme.primary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Theme.primary.opacity(0.15), in: Capsule())
            }

            Text("Honduras")
                .font(.title2.weight(.bold))

            Button {
                selection = .explorar
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            } label: {
                HStack {
                    Text("Explorar territorio")
                        .font(.subheadline.weight(.semibold))
                    Spacer()
                    Image(systemName: "arrow.right")
                        .font(.subheadline.weight(.semibold))
                }
                .foregroundStyle(Color(hex: 0x0B1512))
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(Theme.primary, in: .rect(cornerRadius: 14))
            }
            .buttonStyle(.plain)
        }
        .padding(16)
        .orbitalGlass()
    }

    // MARK: Búsqueda (replica de la lógica web)

    private func handleSearch() {
        let query = search.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return }

        // 1) Coordenadas: "14.07, -87.19" o "14.07 -87.19"
        let pattern = #"^(-?\d{1,2}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)$"#
        if let regex = try? NSRegularExpression(pattern: pattern),
           let match = regex.firstMatch(in: query, range: NSRange(query.startIndex..., in: query)),
           let latRange = Range(match.range(at: 1), in: query),
           let lonRange = Range(match.range(at: 2), in: query),
           let lat = Double(query[latRange]),
           let lon = Double(query[lonRange]),
           abs(lat) <= 90, abs(lon) <= 180 {
            flyTo = GlobeSite(
                id: "coord-\(lat)-\(lon)",
                name: query,
                note: "Coordenadas",
                lat: lat,
                lon: lon
            )
            toast = Toast(
                icon: "checkmark.circle",
                style: .success,
                message: "Centrando en \(String(format: "%.3f", lat)), \(String(format: "%.3f", lon))"
            )
            return
        }

        // 2) Sitio conocido
        let q = query.lowercased()
        if let site = GlobeSites.all.first(where: {
            $0.name.lowercased().contains(q)
                || q.contains($0.name.lowercased().split(separator: " ").first ?? "")
        }) {
            flyTo = site
            toast = Toast(icon: "mappin.circle", style: .success, message: "\(site.name) · \(site.note)")
            return
        }

        toast = Toast(
            icon: "xmark.octagon",
            style: .error,
            message: "Sin resultados. Prueba un sitio de Honduras o coordenadas."
        )
    }
}

// MARK: - Toast

struct Toast: Equatable {
    enum Style { case success, error }
    var icon: String
    var style: Style
    var message: String
}

struct ToastView: View {
    let toast: Toast

    var body: some View {
        VStack {
            HStack(spacing: 8) {
                Image(systemName: toast.icon)
                    .foregroundStyle(toast.style == .success ? Theme.primary : Color(hex: 0xE2635B))
                Text(toast.message)
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(Theme.foreground)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .orbitalGlass(cornerRadius: 14)
            .padding(.top, 64)
            Spacer()
        }
    }
}
