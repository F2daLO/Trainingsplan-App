MEIN TRAINING – V4 MIT SUPABASE-SYNCHRONISIERUNG

Die App ist bereits vorkonfiguriert für:
Project URL: https://vhbhocfjzrgdcekjuime.supabase.co
Publishable Key: in der App hinterlegt.

VOR DEM ERSTEN LOGIN:
1. In Supabase: Authentication -> URL Configuration öffnen.
2. Deine GitHub-Pages-App als Site URL bzw. Additional Redirect URL eintragen.
   Beispiel:
   https://DEINNAME.github.io/mein-trainingsplan/
3. Authentication -> Providers -> Email muss aktiviert sein.

ERSTER SYNC:
1. Alle Dateien dieser ZIP in dein bestehendes GitHub-Pages-Repository hochladen
   und die alten App-Dateien ersetzen.
2. App am iPhone öffnen.
3. Einstellungen -> Cloud-Synchronisierung -> Per E-Mail anmelden.
4. E-Mail eingeben und Magic-Link senden.
5. Den Magic-Link auf demselben iPhone öffnen.
6. Danach startet der erste Sync automatisch.
7. Unter Einstellungen kannst du zusätzlich „Jetzt synchronisieren“ drücken.

DATENSICHERHEIT / MERGE:
- Der lokale 6-Wochen-Plan wird beim ersten Sync nicht gelöscht.
- Bestehende Trainings-IDs bleiben erhalten.
- Lokale Daten werden bei leerer Cloud hochgeladen.
- Cloud-only Daten werden lokal ergänzt.
- Bei derselben Einheit gewinnt die neuere updated_at-Version.
- Status, Notizen, Verschieben, On-Top-Markierung und Reminder-Einstellungen werden synchronisiert.
- Das lokale JSON-Backup bleibt zusätzlich erhalten.

NOCH NICHT AKTIV:
Die Reminder-Daten werden synchronisiert. Die tatsächliche iPhone-Push-Zustellung
benötigt noch den nächsten Schritt mit Push Subscription + Scheduler/Edge Function + Web Push.
