# Anjan Digital Vault

Run local:  npm install && ADMIN_PASSWORD=tomarpass npm start   ->  http://localhost:3000

Railway deploy:
1. GitHub e push koro -> Railway: New Project -> Deploy from GitHub repo
2. Variables: ADMIN_PASSWORD=<tomar password>, UPLOAD_DIR=/data
3. Volume add koro, mount path: /data
4. Settings -> Networking -> Generate Domain

Optional variables: BG_URL (default background), MAX_MB (upload limit, 0 = no limit)
Background photo / theme: Admin -> Settings tab theke bodlano jay.
