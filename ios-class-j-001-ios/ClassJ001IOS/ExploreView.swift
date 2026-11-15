//
//  ExploreView.swift
//  ClassJ001IOS
//
//  Exploración SAR real: adquisiciones NISAR (GCOV) que cubren Honduras,
//  quicklooks oficiales del ASF y detalle con todas las vistas de browse.
//
//  Funciones replicadas de la web:
//  · Time-lapse: orden cronológico ascendente, 1,5 s por fotograma,
//    precarga concurrente (6 en paralelo).
//  · Modo enfoque: la quicklook a sangre completa con la línea de tiempo;
//    se sale con el botón.
//  · Visor 1:1 a pantalla completa: pellizco/arrastre, doble toque
//    restablece (los PNG oficiales son 2007×1973 px).
//  · Enlace a ASF Vertex por adquisición.
//

import SwiftUI

struct ExploreView: View {
    @State private var granules: [NisarGranule] = []
    @State private var isLoading = false
    @State private var error: String?
    @State private var selected: NisarGranule?

    // Time-lapse y modo enfoque
    @State private var focusMode = false
    @State private var isPlaying = false
    @State private var timelineIndex = 0
    @State private var imageCache: [String: UIImage] = [:]

    /// Orden cronológico ascendente (antiguo → reciente), como la web.
    private var chronological: [NisarGranule] {
        granules.sorted { ASFClient.date($0.stopTime) < ASFClient.date($1.stopTime) }
    }

    var body: some View {
        Group {
            if focusMode {
                focusTimeLapse
            } else if isLoading && granules.isEmpty {
                ProgressView("Consultando ASF SearchAPI…")
                    .tint(Theme.primary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error, granules.isEmpty {
                errorView(error)
            } else {
                granuleList
            }
        }
        .background(Theme.background)
        .navigationTitle("Explorar")
        .toolbar {
            if !granules.isEmpty && !focusMode {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        timelineIndex = 0
                        focusMode = true
                        isPlaying = true
                        Task { await preloadImages() }
                    } label: {
                        Image(systemName: "play.circle")
                    }
                }
            }
        }
        .task { await reload() }
        .refreshable { await reload() }
        .sheet(item: $selected) { granule in
            GranuleDetailSheet(granule: granule)
        }
    }

    // MARK: Estados

    private func errorView(_ message: String) -> some View {
        ContentUnavailableView {
            Label("Sin conexión con ASF", systemImage: "wifi.exclamationmark")
        } description: {
            Text(message)
        } actions: {
            Button("Reintentar") { Task { await reload() } }
                .buttonStyle(.borderedProminent)
                .tint(Theme.primary)
        }
    }

    // MARK: Lista

    private var granuleList: some View {
        List {
            Section {
                ForEach(granules) { granule in
                    Button { selected = granule } label: { GranuleRow(granule: granule) }
                        .buttonStyle(.plain)
                }
            } header: {
                Text("Adquisiciones NISAR · GCOV · punto central de Honduras · \(granules.count) reales")
                    .font(.caption2)
            } footer: {
                Text(
                    "Datos reales del ASF SearchAPI (NASA ASF DAAC). "
                        + "Tira hacia abajo para reconsultar; el botón de reproducir inicia el time-lapse."
                )
                .font(.caption2)
            }
        }
        .scrollContentBackground(.hidden)
        .listStyle(.insetGrouped)
    }

    // MARK: Modo enfoque · time-lapse

    private var focusTimeLapse: some View {
        let frames = chronological
        let current = frames.indices.contains(timelineIndex) ? frames[timelineIndex] : nil

        return ZStack {
            Color(Theme.background).ignoresSafeArea()

            if let current, let urlString = current.browse.latlon ?? current.browse.thumbnail,
               let url = URL(string: urlString) {
                VStack(spacing: 0) {
                    if let image = imageCache[urlString] {
                        Image(uiImage: image)
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .clipped()
                            .onTapGesture { selected = current }
                    } else {
                        Color(Theme.panel)
                            .aspectRatio(1, contentMode: .fit)
                            .overlay {
                                AsyncImage(url: url) { phase in
                                    if let image = phase.image {
                                        image.resizable().aspectRatio(contentMode: .fit)
                                    }
                                }
                                .allowsHitTesting(false)
                                .overlay {
                                    if imageCache[urlString] == nil {
                                        ProgressView()
                                            .tint(Theme.primary)
                                    }
                                }
                            }
                            .onTapGesture { selected = current }
                    }
                    Spacer()
                }
            }

            VStack {
                HStack {
                    Button {
                        isPlaying = false
                        focusMode = false
                    } label: {
                        Image(systemName: "eye.slash")
                            .font(.body.weight(.semibold))
                            .foregroundStyle(Theme.foreground)
                            .frame(width: 40, height: 40)
                    }
                    .orbitalGlass(cornerRadius: 14, interactive: true)
                    Spacer()
                    if let current {
                        Text(ASFClient.formatDate(current.stopTime))
                            .font(.subheadline.weight(.semibold))
                            .monospacedDigit()
                            .foregroundStyle(Theme.foreground)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .orbitalGlass(cornerRadius: 14)
                    }
                }
                .padding(.horizontal, 16)

                Spacer()

                // Línea de tiempo estilo web: play/pausa + slider + contador
                GlassGroup(spacing: 12) {
                    HStack(spacing: 14) {
                        Button {
                            isPlaying.toggle()
                            UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        } label: {
                            Image(systemName: isPlaying ? "pause.fill" : "play.fill")
                                .font(.body.weight(.semibold))
                                .foregroundStyle(Theme.foreground)
                                .frame(width: 40, height: 40)
                        }
                        .orbitalGlass(cornerRadius: 14, interactive: true)

                        VStack(spacing: 4) {
                            Slider(
                                value: Binding(
                                    get: { Double(timelineIndex) },
                                    set: { timelineIndex = Int($0) }
                                ),
                                in: 0...max(1, Double(frames.count - 1)),
                                step: 1
                            ) { editing in
                                if editing { isPlaying = false }
                            }
                            .tint(Theme.primary)

                            HStack {
                                Text(frames.first.map { ASFClient.formatDate($0.stopTime) } ?? "")
                                Spacer()
                                Text("\(timelineIndex + 1) / \(frames.count)")
                                Spacer()
                                Text(frames.last.map { ASFClient.formatDate($0.stopTime) } ?? "")
                            }
                            .font(.caption2)
                            .monospacedDigit()
                            .foregroundStyle(Theme.muted)
                        }

                        Text("1,5 s / fotograma")
                            .font(.caption2)
                            .foregroundStyle(Theme.muted)
                    }
                    .padding(14)
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 12)
            }
        }
        .task(id: isPlaying) {
            guard isPlaying, !frames.isEmpty else { return }
            while isPlaying {
                try? await Task.sleep(nanoseconds: 1_500_000_000)
                guard isPlaying else { break }
                timelineIndex = (timelineIndex + 1) % frames.count
                UISelectionFeedbackGenerator().selectionChanged()
            }
        }
        .task {
            await preloadImages()
        }
    }

    /// Precarga concurrente de los PNG oficiales, 6 en paralelo (como la web).
    private func preloadImages() async {
        let urls = chronological
            .compactMap { $0.browse.latlon ?? $0.browse.thumbnail }
            .filter { imageCache[$0] == nil }
        let chunks = stride(from: 0, to: urls.count, by: 6).map {
            Array(urls[$0 ..< min($0 + 6, urls.count)])
        }
        for chunk in chunks {
            await withTaskGroup(of: (String, UIImage?).self) { group in
                for urlString in chunk {
                    guard let url = URL(string: urlString) else { continue }
                    group.addTask {
                        let data = try? await URLSession.shared.data(from: url).0
                        return (urlString, data.flatMap(UIImage.init(data:)))
                    }
                }
                for await (key, image) in group {
                    if let image { imageCache[key] = image }
                }
            }
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
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

// MARK: - Fila

struct GranuleRow: View {
    let granule: NisarGranule

    var body: some View {
        HStack(spacing: 12) {
            Color(Theme.panel)
                .frame(width: 64, height: 64)
                .overlay {
                    if let thumb = granule.browse.thumbnail ?? granule.browse.latlon,
                       let url = URL(string: thumb) {
                        AsyncImage(url: url) { phase in
                            if let image = phase.image {
                                image.resizable().aspectRatio(contentMode: .fill)
                            } else {
                                ProgressView().controlSize(.small)
                            }
                        }
                        .allowsHitTesting(false)
                    }
                }
                .clipShape(.rect(cornerRadius: 10))

            VStack(alignment: .leading, spacing: 3) {
                Text(granule.sceneName)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Theme.foreground)
                    .lineLimit(1)
                Text("\(ASFClient.formatDate(granule.stopTime)) · \(ASFClient.formatTime(granule.stopTime))")
                    .font(.caption)
                    .foregroundStyle(Theme.muted)
                    .monospacedDigit()
                HStack(spacing: 6) {
                    Label(
                        granule.isAscending ? "Asc" : "Desc",
                        systemImage: granule.isAscending ? "arrow.up" : "arrow.down"
                    )
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(granule.isAscending ? Theme.primary : Theme.warning)
                    Text("p\(granule.pathNumber) · f\(granule.frameNumber)")
                        .font(.caption2)
                        .foregroundStyle(Theme.muted)
                        .monospacedDigit()
                }
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.muted)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Visor 1:1 (pellizco/arrastre, doble toque restablece)

struct ZoomableQuicklook: View {
    let url: URL?
    let caption: String

    @Environment(\.dismiss) private var dismiss
    @State private var scale: CGFloat = 1
    @State private var lastScale: CGFloat = 1
    @State private var offset: CGSize = .zero
    @State private var lastOffset: CGSize = .zero

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            if let url {
                AsyncImage(url: url) { phase in
                    if let image = phase.image {
                        image.resizable().aspectRatio(contentMode: .fit)
                    } else {
                        ProgressView("Cargando PNG oficial a 1:1…")
                            .tint(Theme.primary)
                    }
                }
                .scaleEffect(scale)
                .offset(offset)
                .gesture(
                    MagnifyGesture()
                        .onChanged { value in
                            scale = max(1, min(8, lastScale * value.magnification))
                        }
                        .onEnded { _ in lastScale = scale }
                )
                .simultaneousGesture(
                    DragGesture()
                        .onChanged { value in
                            guard scale > 1 else { return }
                            offset = CGSize(
                                width: lastOffset.width + value.translation.width,
                                height: lastOffset.height + value.translation.height
                            )
                        }
                        .onEnded { _ in lastOffset = offset }
                )
                .onTapGesture(count: 2) {
                    withAnimation(.snappy) {
                        scale = 1
                        lastScale = 1
                        offset = .zero
                        lastOffset = .zero
                    }
                }
            }

            VStack {
                HStack {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(Theme.foreground)
                            .padding(10)
                            .orbitalGlass(cornerRadius: 12)
                    }
                    .accessibilityLabel("Cerrar")
                    Spacer()
                    Text(caption)
                        .font(.caption)
                        .monospacedDigit()
                        .foregroundStyle(Theme.foreground)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .orbitalGlass(cornerRadius: 12)
                    Spacer()
                    Text("Doble toque restablece")
                        .font(.caption2)
                        .foregroundStyle(Theme.muted)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .orbitalGlass(cornerRadius: 12)
                }
                .padding(16)
                Spacer()
            }
        }
    }
}

// MARK: - Detalle con quicklooks

struct GranuleDetailSheet: View {
    let granule: NisarGranule
    @Environment(\.dismiss) private var dismiss
    @State private var viewIndex = 0
    @State private var showFullViewer = false

    private var views: [(key: String, label: String, url: String?)] {
        granule.browse.allViews
    }

    /// Enlace de búsqueda en ASF Vertex para esta adquisición concreta.
    private var vertexURL: URL {
        URL(string: "https://search.asf.alaska.edu/#/?dataset=NISAR&productList=\(granule.sceneName)")!
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if views.indices.contains(viewIndex), let urlString = views[viewIndex].url,
                   let url = URL(string: urlString) {
                    Button { showFullViewer = true } label: {
                        Color(Theme.panel)
                            .aspectRatio(1, contentMode: .fit)
                            .overlay {
                                AsyncImage(url: url) { phase in
                                    if let image = phase.image {
                                        image.resizable().aspectRatio(contentMode: .fit)
                                    } else {
                                        ProgressView("Cargando quicklook oficial…")
                                            .tint(Theme.primary)
                                    }
                                }
                                .allowsHitTesting(false)
                            }
                            .overlay(alignment: .bottomTrailing) {
                                Label("Ver 1:1", systemImage: "arrow.up.left.and.arrow.down.right")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(Theme.foreground)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .orbitalGlass(cornerRadius: 12)
                                    .padding(10)
                            }
                    }
                    .buttonStyle(.plain)
                }

                if views.count > 1 {
                    Picker("Vista", selection: $viewIndex) {
                        ForEach(Array(views.enumerated()), id: \.offset) { i, v in
                            Text(v.label).tag(i)
                        }
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                }

                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        metadataGrid

                        if let size = ASFClient.formatBytes(granule.bytesH5) {
                            Label(
                                "Producto completo (\(size)) requiere cuenta gratuita de NASA Earthdata; los quicklooks PNG son públicos.",
                                systemImage: "lock.doc"
                            )
                            .font(.caption)
                            .foregroundStyle(Theme.muted)
                        }

                        HStack {
                            Link(destination: vertexURL) {
                                Label("Ver en ASF Vertex", systemImage: "arrow.up.right.square")
                                    .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(Theme.primary)

                            Link(destination: URL(string: granule.url)!) {
                                Label("HDF5", systemImage: "arrow.down.circle")
                                    .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.bordered)
                            .tint(Theme.primary)
                        }

                        Text(
                            "Fuente: NASA/ISRO NISAR · ASF Distributed Active Archive Center. "
                                + "fileID \(granule.fileID)."
                        )
                        .font(.caption2)
                        .foregroundStyle(Theme.muted)
                    }
                    .padding(16)
                }
            }
            .background(Theme.background)
            .navigationTitle(granule.sceneName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Listo") { dismiss() }
                }
            }
            .fullScreenCover(isPresented: $showFullViewer) {
                ZoomableQuicklook(
                    url: views.indices.contains(viewIndex) ? views[viewIndex].url.flatMap(URL.init(string:)) : nil,
                    caption: "\(granule.sceneName) · \(views.indices.contains(viewIndex) ? views[viewIndex].label : "")"
                )
            }
        }
        .preferredColorScheme(.dark)
    }

    private var metadataGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible())], spacing: 12) {
            MetadataCard(label: "Adquisición", value: ASFClient.formatDate(granule.stopTime), icon: "calendar")
            MetadataCard(label: "Hora UTC", value: ASFClient.formatTime(granule.stopTime), icon: "clock")
            MetadataCard(
                label: "Dirección",
                value: granule.isAscending ? "Ascendente" : "Descendente",
                icon: granule.isAscending ? "arrow.up.right" : "arrow.down.right"
            )
            MetadataCard(
                label: "Órbita",
                value: "p\(granule.pathNumber) · f\(granule.frameNumber)",
                icon: "satellite"
            )
            MetadataCard(label: "Nivel", value: granule.processingLevel, icon: "square.3.layers.3d")
            MetadataCard(label: "Formato", value: "HDF5 · banda L / S", icon: "waveform")
        }
    }
}

struct MetadataCard: View {
    let label: String
    let value: String
    let icon: String

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Label(label, systemImage: icon)
                .font(.caption2)
                .foregroundStyle(Theme.muted)
                .textCase(.uppercase)
                .kerning(1)
            Text(value)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.foreground)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .orbitalGlass(cornerRadius: 14)
    }
}
