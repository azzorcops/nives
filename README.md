# Noi due 💗

Uno spazio privato per due persone, dietro una password. Contiene:

- **Home** con il contatore "stiamo insieme da X giorni" (anni/mesi/giorni), il countdown al prossimo momento in calendario, un countdown opzionale a quando vi rivedete, un "motivo a caso" e l'ultima foto.
- **Calendario** condiviso: eventi con categoria (anniversario, cena, viaggio…), nota, e pallini sui giorni pieni.
- **Foto**: galleria condivisa con didascalia e data, apertura a schermo intero.
- **Bacheca**: bigliettini/note d'amore da appendere, con firma.
- **Desideri**: lista di cose da fare insieme, spuntabili, con barra di avanzamento.
- **Motivi**: la lista dei "motivi per cui ti amo".
- **Impostazioni** (⚙): nomi, data di inizio, data del prossimo incontro.

Niente servizi esterni: gira su Node ed è tutto vostro.

## Cosa serve
- [Node.js](https://nodejs.org) 18 o superiore.

## Avvio in locale (per provarlo)
```bash
cd noidue
npm install
```
Windows (PowerShell):
```powershell
$env:APP_PASSWORD="la-vostra-password"; $env:COUPLE_NAME="I vostri nomi"; npm start
```
macOS/Linux:
```bash
APP_PASSWORD="la-vostra-password" COUPLE_NAME="I vostri nomi" npm start
```
Poi apri `http://localhost:3000`.

## Impostazioni (variabili d'ambiente)
| Variabile        | A cosa serve                                | Default    |
|------------------|---------------------------------------------|------------|
| `APP_PASSWORD`   | La parola segreta per entrare               | `cambiami` |
| `COUPLE_NAME`    | Nome che appare in alto e nel login         | `Noi due`  |
| `SESSION_SECRET` | Chiave dei cookie (metti una stringa lunga a caso e FISSA) | generata a ogni avvio |
| `PORT`           | Porta                                       | `3000`     |
| `MAX_UPLOAD_MB`  | Dimensione massima per foto                 | `15`       |

I nomi, la data d'inizio e la data del prossimo incontro si impostano anche dentro l'app (⚙ Impostazioni).

## Dove finiscono i dati
Tutto in `data/`: `data/db.json` (testi, eventi, note, desideri, motivi, impostazioni) e `data/uploads/` (le foto). Backup = copiare la cartella `data/`.

## Tenerlo online su un VPS
```bash
# sul server (Ubuntu), una volta installato Node:
npm install -g pm2
cd noidue && npm install
APP_PASSWORD="..." SESSION_SECRET="stringa-lunga-fissa" COUPLE_NAME="I vostri nomi" pm2 start server.js --name noidue
pm2 save
pm2 startup   # esegui la riga che stampa
```
Per dominio + https, metti davanti Caddy con un `reverse_proxy localhost:3000`.
