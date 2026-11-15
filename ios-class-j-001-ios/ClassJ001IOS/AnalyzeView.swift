//
//  AnalyzeView.swift
//  ClassJ001IOS
//
//  Análisis por departamento: contorno oficial simplificado (GeoBoundaries
//  ADM1) consultado como WKT contra el ASF SearchAPI, con estadísticas reales
//  e histograma mensual (Swift Charts).
//

import SwiftUI
import Charts

struct AnalyzeView: View {
    @State private var departments: [Department] = []
    @State private var selected: Department?
    @State private var granules: [NisarGranule] = []
    @State private var isLoading = false
    @State private var error: String?

    var body: some View {
        VStack(spacing: 0) {
            departmentPicker
                .padding(.horizontal, 16)
                .padding(.vertical, 10)

            if isLoading {
                ProgressView("Consultando \(selected?.name ?? "Honduras") en ASF…")
                    .tint(Theme.primary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error {
                ContentUnavailableView {
                    Label("La consulta falló", systemImage: "wifi.exclamationmark")
                } description: {
                    Text(error)
                } actions: {
                    Button("Reintentar") { Task { await analyze() } }
                        .buttonStyle(.borderedProminent)
                        .tint(Theme.primary)
                }
            } else if granules.isEmpty, let selected {
                ContentUnavailableView {
                    Label("Sin cobertura NISAR", systemImage: "satellite.slash")
                } description: {
                    Text("El ASF SearchAPI no devolvió adquisiciones GCOV que intersequan \(selected.name). Las áreas sin cobertura se reportan con honestidad.")
                }
            } else if let selected {
                StatsPanel(department: selected, granules: granules)
            } else {
                ContentUnavailableView(
                    "Elige un departamento",
                    systemImage: "map",
                    description: Text("Selecciona uno de los 18 departamentos para consultar sus adquisiciones reales.")
                )
                .foregroundStyle(Theme.muted)
            }
        }
        .background(Theme.background)
        .navigationTitle("Analizar")
        .onAppear {
            if departments.isEmpty {
                departments = GeoKit.loadDepartments()
            }
        }
        .onChange(of: selected) {
            Task { await analyze() }
        }
    }

    private var departmentPicker: some View {
        Picker("Departamento", selection: $selected) {
            Text("—").tag(Department?.none)
            ForEach(departments) { d in
                Text(d.name).tag(Department?.some(d))
            }
        }
        .pickerStyle(.menu)
        .tint(Theme.primary)
        .orbitalGlass(cornerRadius: 14)
    }

    private func analyze() async {
        guard let selected else { return }
        isLoading = true
        error = nil
        granules = []
        do {
            granules = try await ASFClient.searchNisar(
                areaWkt: GeoKit.wktPolygon(selected.ring),
                maxResults: 200
            )
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

// MARK: - Panel de estadísticas

private struct StatsPanel: View {
    let department: Department
    let granules: [NisarGranule]

    private var total: Int { granules.count }

    private var revisitMedian: Int? {
        let times = granules.map { ASFClient.date($0.stopTime) }.sorted()
        guard times.count > 1 else { return nil }
        let gaps = zip(times, times.dropFirst()).map { $1.timeIntervalSince($0) / 86_400 }
        return Int(gaps.sorted()[gaps.count / 2].rounded())
    }

    private var asc: Int { granules.filter(\.isAscending).count }
    private var desc: Int { granules.filter({ !$0.isAscending }).count }

    private var monthly: [(label: String, year: Int, month: Int, count: Int)] {
        let calendar = Calendar(identifier: .gregorian)
        var counts: [String: Int] = [:]
        for g in granules {
            let comps = calendar.dateComponents([.year, .month], from: ASFClient.date(g.stopTime))
            let key = String(format: "%04d-%02d", comps.year ?? 0, comps.month ?? 0)
            counts[key, default: 0] += 1
        }

        let labelFormatter = DateFormatter()
        labelFormatter.locale = Locale(identifier: "es_HN")
        labelFormatter.dateFormat = "MMM yy"
        labelFormatter.timeZone = TimeZone(identifier: "UTC")

        return counts
            .map { key, count -> (String, Int, Int, Int) in
                let parts = key.split(separator: "-")
                let year = parts.first.flatMap { Int($0) } ?? 0
                let month = parts.dropFirst().first.flatMap { Int($0) } ?? 0
                let label = labelFormatter.string(from: ASFClient.date(key + "-01T00:00:00+0000"))
                return (label, year, month, count)
            }
            .sorted { $0.1 != $1.1 ? $0.1 < $1.1 : $0.2 < $1.2 }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("\(department.name) · contorno oficial simplificado (\(department.ring.count) vértices de GeoBoundaries ADM1)")
                    .font(.caption)
                    .foregroundStyle(Theme.muted)

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    MetadataCard(label: "Adquisiciones", value: String(total), icon: "square.stack.3d.up")
                    MetadataCard(
                        label: "Revisita mediana",
                        value: revisitMedian.map { "\($0) días" } ?? "—",
                        icon: "arrow.triangle.2.circlepath"
                    )
                    MetadataCard(label: "Ascendentes", value: String(asc), icon: "arrow.up.right")
                    MetadataCard(label: "Descendentes", value: String(desc), icon: "arrow.down.right")
                }

                if !monthly.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        Label("Adquisiciones por mes", systemImage: "chart.bar")
                            .font(.caption)
                            .foregroundStyle(Theme.muted)
                            .textCase(.uppercase)
                            .kerning(1)

                        Chart(monthly, id: \.label) { m in
                            BarMark(
                                x: .value("Mes", m.label),
                                y: .value("Adquisiciones", m.count)
                            )
                            .foregroundStyle(Theme.primary.opacity(0.7))
                            .cornerRadius(3)
                        }
                        .chartXAxis {
                            AxisMarks { value in
                                AxisValueLabel {
                                    if let text = value.as(String.self) {
                                        // "jun 26" -> "jun" (abreviatura del mes)
                                        let month = text.split(separator: " ").first.map(String.init) ?? text
                                        Text(month).font(.caption2)
                                    }
                                }
                            }
                        }
                        .frame(height: 160)
                    }
                    .padding(14)
                    .orbitalGlass(cornerRadius: 16)
                }

                VStack(alignment: .leading, spacing: 8) {
                    Label("Adquisiciones más recientes", systemImage: "list.bullet")
                        .font(.caption)
                        .foregroundStyle(Theme.muted)
                        .textCase(.uppercase)
                        .kerning(1)

                    ForEach(granules.prefix(10)) { g in
                        GranuleRow(granule: g)
                    }

                    Link(destination: URL(string: "https://search.asf.alaska.edu/")!) {
                        Label("Ver en ASF Vertex (cuenta gratuita Earthdata)", systemImage: "arrow.up.right.square")
                            .font(.subheadline.weight(.semibold))
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Theme.primary)
                }

                Text("Fuente: ASF SearchAPI (NASA ASF DAAC), consulta `intersectsWith=POLYGON(...)` con el contorno del departamento. Sin datos simulados.")
                    .font(.caption2)
                    .foregroundStyle(Theme.muted)
            }
            .padding(16)
        }
    }
}
