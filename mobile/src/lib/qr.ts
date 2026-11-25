/**
 * QR code de l'AgroID (J19). Contenu : le lien de la parcelle dans l'app terrain
 * (https://terrain.pestai.africa/a/PAI-SN-XXXXXXXX). Un téléphone ordinaire ouvre le lien ;
 * l'app terrain lit aussi un AgroID seul. Correction d'erreur M (≈ 15 %) : lisible sur une
 * fiche plastifiée un peu abîmée.
 */
import qrcode from "qrcode-generator";

export const TERRAIN_BASE = "https://terrain.pestai.africa";

export function agroidUrl(agroid: string): string {
  return `${TERRAIN_BASE}/a/${agroid}`;
}

/** Matrice de modules (true = noir). */
export function qrMatrix(text: string): boolean[][] {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

/** Chemin SVG des modules noirs (un rectangle par série horizontale), marge de 4 modules. */
export function qrPath(matrix: boolean[][], margin = 4): { size: number; d: string } {
  const n = matrix.length;
  let d = "";
  matrix.forEach((row, y) => {
    let x = 0;
    while (x < n) {
      if (!row[x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < n && row[x]) x++;
      d += `M${start + margin} ${y + margin}h${x - start}v1h${start - x}z`;
    }
  });
  return { size: n + 2 * margin, d };
}

/** AgroID trouvé dans un texte scanné (lien, AgroID seul, espaces ou tirets libres). */
export function agroidFromText(text: string): string | null {
  const m = /PAI[\s-]?([A-Z]{2})[\s-]?([0-9A-HJKMNP-TV-Z]{8})/i.exec(text.toUpperCase());
  return m ? `PAI-${m[1]}-${m[2]}` : null;
}
