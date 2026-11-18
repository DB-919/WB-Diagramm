BECKER WB VIEWER V1.1
=====================

Zweck
-----
Sehr einfache Web-App zum Einlesen und Darstellen von Wärmebehandlungsdaten.
Keine Datenbank, keine Projekte, keine QS-Freigabe, keine Zugversuche.
Alle Daten werden ausschließlich lokal im Browser verarbeitet.

Neu in V1.1
-----------
- Messkanäle frei benennbar (z. B. CH1 -> Ofen links)
- Bis zu 5 Solltemperaturbereiche als farbige Diagrammbänder
- Sollbereich über Solltemperatur ± Toleranz definierbar
- Haltezeit mit Start und Ende markieren
- Haltezeit-Start/-Ende alternativ direkt per Klick im Diagramm setzen
- Haltezeitdauer wird automatisch angezeigt
- Kanalnamen werden in Legende, Tooltip, Kennwertkarten und CSV-Export übernommen
- Sollbereiche und Haltezeitmarker werden auch in PNG, SVG und Browser-PDF ausgegeben

Unterstützte Dateien
--------------------
- MN/AT Logger-TXT:
  MN/AT  date  time  int  1ch  2ch  3ch  4ch  unit
- CSV / TSV / Semikolon-Texttabellen mit CH1... bzw. 1ch...
- Zeitinformation über Datum+Uhrzeit, Timestamp oder Zeit in min/s/h

Funktionen
----------
- Datei per Auswahl oder Drag & Drop
- Kanäle ein-/ausblenden und umbenennen
- Diagramm optional ab frei wählbarer Starttemperatur
- X-Achse Minuten oder Stunden
- Y-Achse automatisch oder manuell
- Solltemperaturbereiche im Diagramm
- Haltezeitmarkierung mit direkter Klick-Auswahl
- Min/Max-erhaltendes Downsampling für große Messdateien
- interaktive Werteanzeige
- Export als PNG, SVG und CSV
- Drucken / PDF über den Browser

Direkt auf Windows starten
--------------------------
index.html doppelklicken. TXT/CSV/TSV können direkt ausgewählt werden.

Als Web-App / iPhone-Home-Screen-App
------------------------------------
Den kompletten Ordner z. B. über GitHub Pages veröffentlichen.
Danach die Seite auf iPhone/iPad in Safari öffnen und
"Zum Home-Bildschirm" wählen.
Bei HTTPS wird ein Service Worker registriert und die App kann nach dem
ersten Laden auch offline verfügbar sein.

Hinweis
-------
Excel-XLSX ist bewusst nicht enthalten, damit die App vollständig
abhängigkeitsfrei und offline lauffähig bleibt.
