import Foundation
import Security
import Supabase

/// Connection to the SAME Supabase backend the website uses, so notes sync across
/// web and phone. The anon (publishable) key is safe to ship in a client — Row Level
/// Security on every table restricts each user to their own rows.
enum Config {
    static let supabaseURL = URL(string: "https://olkewpfbutbnwvulhuvg.supabase.co")!
    static let supabaseAnonKey = "sb_publishable_Dzwb0Km2Q0Wdhe3HIs9lMg_59QnYHT1"

    /// Gemini key lives in the git-ignored Secrets.swift (see LynxApp/Secrets.swift.example).
    static var geminiKey: String { Secrets.geminiKey }
}

/// Keychain-backed session store. The auth session contains the long-lived refresh
/// token, which must NOT sit in UserDefaults (plaintext plist, included in backups).
/// Items use kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly: readable after the
/// first unlock (so background refresh works) and never migrated to other devices.
/// Falls back to — and migrates from — the old UserDefaults store on first read.
struct KeychainLocalStorage: AuthLocalStorage {
    private let service = "com.garimella.lynx.auth"

    private func query(_ key: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
    }

    func store(key: String, value: Data) throws {
        var add = query(key)
        add[kSecValueData as String] = value
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let status = SecItemAdd(add as CFDictionary, nil)
        if status == errSecDuplicateItem {
            let update = [kSecValueData as String: value] as CFDictionary
            let upStatus = SecItemUpdate(query(key) as CFDictionary, update)
            guard upStatus == errSecSuccess else {
                throw NSError(domain: NSOSStatusErrorDomain, code: Int(upStatus))
            }
        } else if status != errSecSuccess {
            throw NSError(domain: NSOSStatusErrorDomain, code: Int(status))
        }
    }

    func retrieve(key: String) throws -> Data? {
        var q = query(key)
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: AnyObject?
        let status = SecItemCopyMatching(q as CFDictionary, &out)
        if status == errSecSuccess, let data = out as? Data { return data }

        // One-time migration: earlier builds kept the session in UserDefaults.
        if let legacy = UserDefaults.standard.data(forKey: key) {
            try? store(key: key, value: legacy)
            UserDefaults.standard.removeObject(forKey: key)
            return legacy
        }
        return nil
    }

    func remove(key: String) throws {
        SecItemDelete(query(key) as CFDictionary)
        UserDefaults.standard.removeObject(forKey: key) // clear any legacy copy too
    }
}

let supabase = SupabaseClient(
    supabaseURL: Config.supabaseURL,
    supabaseKey: Config.supabaseAnonKey,
    options: SupabaseClientOptions(
        auth: SupabaseClientOptions.AuthOptions(
            storage: KeychainLocalStorage()
        )
    )
)
