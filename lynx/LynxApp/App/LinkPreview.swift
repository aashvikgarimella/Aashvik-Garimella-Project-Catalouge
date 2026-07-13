import SwiftUI
import UIKit

struct LinkMeta: Identifiable, Hashable {
    var id: String { url.absoluteString }
    let url: URL
    let title: String
    let description: String?
    let imageURL: URL?
    let siteName: String?
}

/// Fetches Open Graph / HTML metadata for a URL to build a link preview.
enum LinkPreviewService {
    static func fetch(_ url: URL) async -> LinkMeta? {
        var req = URLRequest(url: url, timeoutInterval: 8)
        req.setValue("Mozilla/5.0 (compatible; lynx-link-preview)", forHTTPHeaderField: "User-Agent")
        req.setValue("text/html", forHTTPHeaderField: "Accept")
        guard let (data, response) = try? await URLSession.shared.data(for: req) else { return nil }
        let finalURL = response.url ?? url
        let html = String(data: data, encoding: .utf8) ?? String(data: data, encoding: .isoLatin1) ?? ""
        guard !html.isEmpty else { return nil }

        let tags = metaTags(html)
        func content(_ keys: [String]) -> String? {
            for tag in tags {
                let id = tag["property"] ?? tag["name"]
                if let id, keys.contains(id.lowercased()), let c = tag["content"], !c.isEmpty {
                    return decodeEntities(c).trimmingCharacters(in: .whitespacesAndNewlines)
                }
            }
            return nil
        }

        let title = content(["og:title", "twitter:title"]) ?? titleTag(html) ?? (finalURL.host ?? url.absoluteString)
        let desc = content(["og:description", "twitter:description", "description"])
        let imageStr = content(["og:image", "og:image:url", "twitter:image", "twitter:image:src"])
        let image = imageStr.flatMap { URL(string: $0, relativeTo: finalURL)?.absoluteURL }
        let site = content(["og:site_name"]) ?? finalURL.host

        return LinkMeta(url: url, title: title, description: desc, imageURL: image, siteName: site)
    }

    // MARK: HTML parsing

    private static func metaTags(_ html: String) -> [[String: String]] {
        guard let re = try? NSRegularExpression(pattern: "<meta\\b[^>]*>", options: [.caseInsensitive]) else { return [] }
        let attrRe = try? NSRegularExpression(pattern: "([\\w:-]+)\\s*=\\s*\"([^\"]*)\"", options: [.caseInsensitive])
        let ns = html as NSString
        var tags: [[String: String]] = []
        re.enumerateMatches(in: html, range: NSRange(location: 0, length: ns.length)) { match, _, _ in
            guard let match else { return }
            let tag = ns.substring(with: match.range)
            let tns = tag as NSString
            var attrs: [String: String] = [:]
            attrRe?.enumerateMatches(in: tag, range: NSRange(location: 0, length: tns.length)) { am, _, _ in
                guard let am else { return }
                attrs[tns.substring(with: am.range(at: 1)).lowercased()] = tns.substring(with: am.range(at: 2))
            }
            tags.append(attrs)
        }
        return tags
    }

    private static func titleTag(_ html: String) -> String? {
        guard let re = try? NSRegularExpression(pattern: "<title[^>]*>([^<]*)</title>", options: [.caseInsensitive]) else { return nil }
        let ns = html as NSString
        guard let m = re.firstMatch(in: html, range: NSRange(location: 0, length: ns.length)) else { return nil }
        let t = decodeEntities(ns.substring(with: m.range(at: 1))).trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? nil : t
    }

    private static func decodeEntities(_ s: String) -> String {
        var r = s
        let map = ["&amp;": "&", "&quot;": "\"", "&#39;": "'", "&apos;": "'", "&lt;": "<",
                   "&gt;": ">", "&#x27;": "'", "&nbsp;": " ", "&#x2F;": "/", "&#47;": "/"]
        for (k, v) in map { r = r.replacingOccurrences(of: k, with: v) }
        return r
    }
}

struct LinkPreviewCard: View {
    @EnvironmentObject var theme: Theme
    let meta: LinkMeta

    var body: some View {
        Link(destination: meta.url) {
            HStack(spacing: 12) {
                if let img = meta.imageURL {
                    AsyncImage(url: img) { image in
                        image.resizable().scaledToFill()
                    } placeholder: { theme.pill }
                    .frame(width: 64, height: 64)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                } else {
                    ZStack { theme.pill; Image(systemName: "link").foregroundStyle(theme.muted) }
                        .frame(width: 64, height: 64)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                VStack(alignment: .leading, spacing: 3) {
                    Text(meta.title).font(.subheadline.weight(.semibold)).foregroundStyle(theme.text).lineLimit(2)
                    if let d = meta.description, !d.isEmpty {
                        Text(d).font(.caption).foregroundStyle(theme.muted).lineLimit(2)
                    }
                    Text(meta.siteName ?? meta.url.host ?? "").font(.caption2).foregroundStyle(theme.muted.opacity(0.8))
                }
                Spacer(minLength: 0)
            }
            .padding(10)
            .background(theme.surface)
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(theme.border, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button {
                UIApplication.shared.open(meta.url)
            } label: { Label("Open Link", systemImage: "safari") }
            Button {
                UIPasteboard.general.string = meta.url.absoluteString
            } label: { Label("Copy Link", systemImage: "doc.on.doc") }
            ShareLink(item: meta.url) { Label("Share…", systemImage: "square.and.arrow.up") }
        }
    }
}
