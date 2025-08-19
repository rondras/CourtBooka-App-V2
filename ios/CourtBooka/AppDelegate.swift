import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import Firebase
import FirebaseMessaging
import UserNotifications
import GoogleSignIn // Hinzugefügt: Import für GoogleSignIn

@main
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate, MessagingDelegate {
    var window: UIWindow?
    var reactNativeDelegate: ReactNativeDelegate?
    var reactNativeFactory: RCTReactNativeFactory?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        FirebaseApp.configure()

        let center = UNUserNotificationCenter.current()
        center.delegate = self
        center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            if let error = error {
                print("Fehler bei der Berechtigungsanfrage: \(error)")
            } else if granted {
                DispatchQueue.main.async {
                    application.registerForRemoteNotifications()
                }
            }
        }

        Messaging.messaging().delegate = self
        print("Firebase Messaging initialisiert")

        // Die manuelle GIDSignIn.sharedInstance.configuration wird hier NICHT gesetzt,
        // da das @react-native-google-signin/google-signin Modul dies selbst in JS übernimmt.

        let delegate = ReactNativeDelegate()
        let factory = RCTReactNativeFactory(delegate: delegate)
        delegate.dependencyProvider = RCTAppDependencyProvider()

        reactNativeDelegate = delegate
        reactNativeFactory = factory

        window = UIWindow(frame: UIScreen.main.bounds)

        factory.startReactNative(
            withModuleName: "CourtBooka",
            in: window,
            launchOptions: launchOptions
        )
        return true
    }

    // APNs-Token empfangen und an Firebase weiterleiten
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Messaging.messaging().apnsToken = deviceToken
        print("APNs-Token empfangen: \(deviceToken.map { String(format: "%02hhx", $0) }.joined())")
    }

    // Fehler bei der APNs-Registrierung
    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("Fehler bei der APNs-Registrierung: \(error)")
    }

    // Benachrichtigungen im Vordergrund anzeigen
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        let userInfo = notification.request.content.userInfo
        print("Benachrichtigung im Vordergrund: \(userInfo)")
        completionHandler([.alert, .sound, .badge])
    }

    // Benachrichtigungen, wenn sie angeklickt werden
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        let userInfo = response.notification.request.content.userInfo
        print("Benachrichtigung angeklickt: \(userInfo)")
        completionHandler()
    }

    // Firebase Messaging Token empfangen
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        print("FCM-Token empfangen: \(fcmToken ?? "Kein Token")")
    }

    // Hinzugefügt: Google Sign-In URL-Handling gemäß offizieller Doku
    // Dieser Teil ist essentiell, um die Callback-URL von Google zu verarbeiten.
    func application(_ app: UIApplication,
                     open url: URL,
                     options: [UIApplication.OpenURLOptionsKey : Any] = [:]) -> Bool {
        var handled: Bool

        // Handle Google Sign-In URL
        // GIDSignIn.sharedInstance.handle(url) ist der Kern des URL-Handlings für Google Sign-In
        handled = GIDSignIn.sharedInstance.handle(url)
        if handled {
            return true
        }

        // HIER könnten weitere URL-Typen behandelt werden (z.B. andere Deep Links)
        // Wenn keine anderen Deep Links durch ein separates Modul behandelt werden,
        // kann dies einfach 'return false' sein. Für React Native's Linking
        // wird es oft über den RCTLinkingManager in der App-Logik oder
        // durch andere Autolinking-Mechanismen erledigt.
        // Wir fügen hier nicht den RCTLinkingManager hinzu, um die Anleitung der Google-Sign-In-Docs zu folgen.
        return false // Wichtig: Muss 'false' zurückgeben, wenn nicht selbst behandelt
    }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
    override func sourceURL(for bridge: RCTBridge) -> URL? {
        return self.bundleURL()
    }

    override func bundleURL() -> URL? {
#if DEBUG
        return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
        return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
    }
}
