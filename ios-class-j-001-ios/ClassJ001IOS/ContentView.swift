//
//  ContentView.swift
//  ClassJ001IOS
//
//  Shell de navegación: globo + exploración + comparador + análisis + fuentes.
//

import SwiftUI

enum AppTab: Hashable {
    case inicio
    case explorar
    case comparar
    case analizar
    case fuentes
}

struct ContentView: View {
    @State private var selection: AppTab = .inicio

    var body: some View {
        TabView(selection: $selection) {
            Tab("Inicio", systemImage: "globe.americas.fill", value: .inicio) {
                NavigationStack { HomeView(selection: $selection) }
            }

            Tab("Explorar", systemImage: "dot.radiowaves.left.and.right", value: .explorar) {
                NavigationStack { ExploreView() }
            }

            Tab("Comparar", systemImage: "square.split.2x1", value: .comparar) {
                NavigationStack { CompareView() }
            }

            Tab("Analizar", systemImage: "chart.bar.xaxis", value: .analizar) {
                NavigationStack { AnalyzeView() }
            }

            Tab("Fuentes", systemImage: "books.vertical", value: .fuentes) {
                NavigationStack { SourcesView() }
            }
        }
        .preferredColorScheme(.dark)
        .tint(Theme.primary)
    }
}
