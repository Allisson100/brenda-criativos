// ============================================================
// Mídia hospedada
//
// Cole aqui o link do criativo já hospedado (Vercel Blob, S3,
// Cloudflare R2, Bunny, Mux, Drive com link direto — tanto faz).
// A chave é o ID do anúncio; o valor é a URL do arquivo.
//
// Esta é a opção que funciona em produção: o arquivo não entra
// no repositório, só a URL.
//
// Exemplo:
//   "1224081192964534": "https://cdn.yardenlab.com/swipe/1224081192964534.mp4",
//   "1458569535619184": "https://cdn.yardenlab.com/swipe/pamela-papada.mp4",
//
// Ordem de prioridade que o app usa para cada card:
//   1. URL aqui neste arquivo
//   2. arquivo local em src/criativos/<id>.mp4
//   3. botão que abre o anúncio na Biblioteca
// ============================================================

export const MIDIA_HOSPEDADA = {
  // "1224081192964534": "https://...",
}
