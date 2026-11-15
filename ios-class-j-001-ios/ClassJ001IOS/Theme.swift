//
//  Theme.swift
//  ClassJ001IOS
//
//  Sistema de diseño "noche orbital" de Class J-001, portado de la web.
//  Una sola familia tipográfica: la del sistema (SF Pro) — jerarquía
//  solo con pesos y tamaños, cifras con dígitos tabulares.
//
//  Material: Liquid Glass nativo de Apple (iOS 26+, `glassEffect`) con
//  fallback de material translúcido para iOS 18.
//

import SwiftUI

extension Color {
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}

enum Theme {
    static let background = Color(hex: 0x0B1118)
    static let panel = Color(hex: 0x16212C)
    static let primary = Color(hex: 0x7FD6C2)
    static let warning = Color(hex: 0xF2B66D)
    static let foreground = Color(hex: 0xEAF1F5)
    static let muted = Color(hex: 0x8FA2B0)
}

/// Vidrio líquido nativo en iOS 26+, material translúcido antes.
/// `interactive: true` responde al toque (controles, chips).
extension View {
    @ViewBuilder
    func orbitalGlass(cornerRadius: CGFloat = 20, interactive: Bool = false) -> some View {
        if #available(iOS 26.0, *) {
            if interactive {
                self.glassEffect(.regular.interactive(), in: .rect(cornerRadius: cornerRadius))
            } else {
                self.glassEffect(.regular, in: .rect(cornerRadius: cornerRadius))
            }
        } else {
            self
                .background(
                    Theme.panel.opacity(0.72),
                    in: .rect(cornerRadius: cornerRadius)
                )
                .background(.ultraThinMaterial, in: .rect(cornerRadius: cornerRadius))
                .overlay {
                    RoundedRectangle(cornerRadius: cornerRadius)
                        .strokeBorder(.white.opacity(0.09), lineWidth: 1)
                }
        }
    }
}

/// Agrupa superficies de vidrio para que se fundan y morphing (iOS 26+).
/// Antes de iOS 26 renderiza el contenido sin contenedor.
struct GlassGroup<Content: View>: View {
    var spacing: CGFloat = 16
    @ViewBuilder var content: () -> Content

    var body: some View {
        if #available(iOS 26.0, *) {
            GlassEffectContainer(spacing: spacing) { content() }
        } else {
            content()
        }
    }
}
