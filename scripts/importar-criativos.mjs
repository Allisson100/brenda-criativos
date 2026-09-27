#!/usr/bin/env node
/**
 * Importa criativos baixados para dentro do projeto.
 *
 *   npm run importar                             → varre a sua pasta Downloads
 *   npm run importar -- "C:\\...\\videosTeste"    → varre a pasta que você indicar
 *   npm run importar -- "..." --limpar            → apaga o que já havia em src/criativos antes
 *
 * O que faz:
 *   1. varre a pasta (e subpastas) atrás de vídeo/imagem
 *   2. lê o ID do anúncio no nome do arquivo, e o número da peça quando houver
 *        1234567890123.jpg      → anúncio 1234567890123, peça única
 *        1234567890123_3.jpg    → anúncio 1234567890123, peça 3 do carrossel
 *   3. copia para src/criativos/ só o que pertence ao swipe file
 *   4. descarta peça repetida dentro do mesmo anúncio (a Meta às vezes
 *      devolve o primeiro card de novo no fim do carrossel)
 *   5. escreve src/criativos-manifesto.js — ordem das peças, tipo e dimensão,
 *      mais os anúncios que rodam exatamente o mesmo criativo
 *   6. escreve criativos-faltando.txt com os links do que ainda falta
 *
 * Não apaga nem move nada da pasta de origem. Só copia.
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { PROCEDIMENTOS } from '../src/data.js'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const DESTINO = path.join(AQUI, '..', 'src', 'criativos')
const RAIZ = path.join(AQUI, '..')
const MANIFESTO = path.join(AQUI, '..', 'src', 'criativos-manifesto.js')

const VIDEO = new Set(['.mp4', '.webm', '.mov'])
const IMAGEM = new Set(['.gif', '.jpg', '.jpeg', '.png', '.webp'])
const EXTS = new Set([...VIDEO, ...IMAGEM])
const PROFUNDIDADE = 6
const PRESERVAR = new Set(['LEIA-ME.md', '.gitkeep', '_demo.mp4'])

// ─── catálogo do swipe file ────────────────────────────────────────────────
const CATALOGO = new Map()
for (const p of PROCEDIMENTOS) {
  for (const etapa of ['topo', 'meio', 'fundo']) {
    for (const c of p[etapa]) {
      if (!CATALOGO.has(c.id)) {
        CATALOGO.set(c.id, {
          adv: c.adv,
          proc: p.nome,
          etapa,
          peso: (c.escala || 1) + (c.destaque ? 10 : 0),
        })
      }
    }
  }
}

/** "1234567890123_3.jpg" → { id: "1234567890123", peca: 3 } */
function lerNome(nome) {
  const base = path.parse(nome).name
  const m = base.match(/^(\d{10,})(?:[_-](\d+))?$/)
  if (m) return { id: m[1], peca: m[2] ? Number(m[2]) : 1 }
  const solto = base.match(/\d{10,}/)
  return solto ? { id: solto[0], peca: 1 } : null
}

const tipoDe = (ext) => (VIDEO.has(ext) ? 'video' : 'imagem')

/**
 * Dimensão de um MP4/MOV lendo as caixas do arquivo: moov → trak → tkhd.
 * A largura e a altura ficam em ponto fixo 16.16 no fim da tkhd. A faixa
 * de áudio traz 0×0, então ficamos com a maior — a de vídeo.
 */
function dimensaoMp4(b) {
  let melhor = null

  const andar = (ini, fim) => {
    let p = ini
    while (p + 8 <= fim) {
      let tam = b.readUInt32BE(p)
      const tipo = b.toString('latin1', p + 4, p + 8)
      let corpo = p + 8
      if (tam === 1) { tam = Number(b.readBigUInt64BE(p + 8)); corpo = p + 16 }
      if (tam === 0) tam = fim - p
      if (tam < 8 || p + tam > fim) return

      if (tipo === 'moov' || tipo === 'trak' || tipo === 'mdia') {
        andar(corpo, p + tam)
      } else if (tipo === 'tkhd') {
        const versao = b[corpo]
        const base = corpo + (versao === 1 ? 88 : 76)
        if (base + 8 <= p + tam) {
          const w = b.readUInt32BE(base) / 65536
          const h = b.readUInt32BE(base + 4) / 65536
          if (w > 1 && h > 1 && (!melhor || w * h > melhor.w * melhor.h)) {
            melhor = { w: Math.round(w), h: Math.round(h) }
          }
        }
      }
      p += tam
    }
  }

  andar(0, b.length)
  return melhor
}

/** Dimensões sem dependência externa: só o cabeçalho do arquivo. */
function dimensoes(arquivo, ext) {
  try {
    const b = fs.readFileSync(arquivo)
    if (ext === '.mp4' || ext === '.mov' || ext === '.m4v') return dimensaoMp4(b)
    if (ext === '.png' && b.length > 24) {
      return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }
    }
    if (ext === '.gif' && b.length > 10) {
      return { w: b.readUInt16LE(6), h: b.readUInt16LE(8) }
    }
    if (ext === '.webp' && b.slice(12, 16).toString() === 'VP8X') {
      return { w: (b.readUIntLE(24, 3) & 0xffffff) + 1, h: (b.readUIntLE(27, 3) & 0xffffff) + 1 }
    }
    if (ext === '.webp' && b.slice(12, 16).toString() === 'VP8 ') {
      return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff }
    }
    if (ext === '.jpg' || ext === '.jpeg') {
      let i = 2
      while (i < b.length - 9) {
        if (b[i] !== 0xff) { i++; continue }
        const marcador = b[i + 1]
        if (marcador >= 0xc0 && marcador <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marcador)) {
          return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) }
        }
        i += 2 + b.readUInt16BE(i + 2)
      }
    }
  } catch {}
  return null
}

// ─── varredura ─────────────────────────────────────────────────────────────
function varrer(dir, nivel = 0, achados = []) {
  if (nivel > PROFUNDIDADE) return achados
  let itens
  try {
    itens = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return achados
  }
  for (const item of itens) {
    const alvo = path.join(dir, item.name)
    if (item.isDirectory()) {
      if (item.name === 'node_modules' || item.name.startsWith('.')) continue
      if (item.name === '_invalidos' || item.name === '_suspeitos') continue
      varrer(alvo, nivel + 1, achados)
    } else if (EXTS.has(path.extname(item.name).toLowerCase())) {
      achados.push(alvo)
    }
  }
  return achados
}

// ─── execução ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const limpar = args.includes('--limpar')
const origem = args.find((a) => !a.startsWith('--')) || path.join(os.homedir(), 'Downloads')

if (!fs.existsSync(origem)) {
  console.error(`\n  Pasta não encontrada: ${origem}\n`)
  process.exit(1)
}

fs.mkdirSync(DESTINO, { recursive: true })

console.log(`\n  Varrendo  ${origem}`)
console.log(`  Destino   ${path.relative(process.cwd(), DESTINO) || DESTINO}\n`)

if (limpar) {
  let n = 0
  for (const f of fs.readdirSync(DESTINO)) {
    if (PRESERVAR.has(f)) continue
    try { fs.unlinkSync(path.join(DESTINO, f)); n++ } catch {}
  }
  console.log(`  --limpar: ${n} arquivo(s) antigo(s) removido(s)\n`)
}

// agrupa os achados por anúncio
const porAnuncio = new Map()
const forasDoCatalogo = new Set()

for (const arquivo of varrer(origem)) {
  const lido = lerNome(path.basename(arquivo))
  if (!lido) continue
  if (!CATALOGO.has(lido.id)) { forasDoCatalogo.add(lido.id); continue }
  if (!porAnuncio.has(lido.id)) porAnuncio.set(lido.id, [])
  porAnuncio.get(lido.id).push({ arquivo, peca: lido.peca })
}

const md5 = (f) => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex')

const PECAS = {}
const HASH_POR_ANUNCIO = new Map()
const copiados = []
let pecasRepetidas = 0

for (const [id, achados] of [...porAnuncio].sort((a, b) => a[0].localeCompare(b[0]))) {
  achados.sort((a, b) => a.peca - b.peca)

  const vistos = new Set()
  const lista = []

  for (const { arquivo, peca } of achados) {
    const h = md5(arquivo)
    if (vistos.has(h)) { pecasRepetidas++; continue }  // mesma peça de novo no mesmo anúncio
    vistos.add(h)

    const ext = path.extname(arquivo).toLowerCase()
    const nome = achados.length > 1 ? `${id}_${peca}${ext}` : `${id}${ext}`
    fs.copyFileSync(arquivo, path.join(DESTINO, nome))

    const d = dimensoes(arquivo, ext)
    lista.push({ a: nome, t: tipoDe(ext), ...(d ? { w: d.w, h: d.h } : {}) })
  }

  if (!lista.length) continue
  PECAS[id] = lista
  HASH_POR_ANUNCIO.set(id, [...vistos].sort().join('|'))
  copiados.push({ id, pecas: lista.length, ...CATALOGO.get(id) })
}

// anúncios diferentes rodando exatamente o mesmo criativo
const porAssinatura = new Map()
for (const [id, ass] of HASH_POR_ANUNCIO) {
  if (!porAssinatura.has(ass)) porAssinatura.set(ass, [])
  porAssinatura.get(ass).push(id)
}
const GEMEOS = {}
for (const ids of porAssinatura.values()) {
  if (ids.length < 2) continue
  for (const id of ids) GEMEOS[id] = ids.filter((x) => x !== id)
}

// ─── manifesto ─────────────────────────────────────────────────────────────
const linhas = Object.entries(PECAS).map(
  ([id, lista]) => `  '${id}': ${JSON.stringify(lista)},`
)
fs.writeFileSync(
  MANIFESTO,
  `/* Gerado por \`npm run importar\`. Não edite à mão.
   ${new Date().toISOString().slice(0, 16).replace('T', ' ')} — ${Object.keys(PECAS).length} anúncios, ${
    Object.values(PECAS).reduce((n, l) => n + l.length, 0)
  } peças.

   PECAS  ordem das peças de cada anúncio, com tipo e dimensão.
   GEMEOS anúncios diferentes que rodam exatamente o mesmo criativo. */

export const PECAS = {
${linhas.join('\n')}
}

export const GEMEOS = ${JSON.stringify(GEMEOS, null, 2)}

export const GERADO_EM = '${new Date().toISOString()}'
`
)

// ─── relatório ─────────────────────────────────────────────────────────────
const totalPecas = Object.values(PECAS).reduce((n, l) => n + l.length, 0)
const carrosseis = Object.values(PECAS).filter((l) => l.length > 1).length

if (copiados.length) {
  console.log(`  ${copiados.length} anúncio(s), ${totalPecas} peça(s) copiada(s)`)
  console.log(`  ${carrosseis} carrossel(éis), ${copiados.length - carrosseis} peça única`)
  if (pecasRepetidas) console.log(`  ${pecasRepetidas} peça(s) repetida(s) dentro do mesmo anúncio — descartada(s)`)
  const maiores = copiados.filter((c) => c.pecas > 4).sort((a, b) => b.pecas - a.pecas)
  if (maiores.length) {
    console.log(`\n  Carrosséis mais longos:`)
    for (const c of maiores.slice(0, 6)) console.log(`   ${String(c.pecas).padStart(2)} peças  ${c.adv} — ${c.proc}`)
  }
} else {
  console.log('  Nenhum arquivo do swipe file encontrado nessa pasta.')
}

const gemeos = Object.keys(GEMEOS).length
if (gemeos) console.log(`\n  ${gemeos} anúncio(s) rodando criativo idêntico a outro — marcados no site como criativo escalado`)
if (forasDoCatalogo.size) console.log(`  ${forasDoCatalogo.size} ID(s) com arquivo, mas fora do swipe file (ignorados)`)

const faltando = [...CATALOGO.entries()]
  .filter(([id]) => !PECAS[id])
  .sort((a, b) => b[1].peso - a[1].peso)

console.log(`\n  ── Situação ──────────────────────────────`)
console.log(`  No projeto:  ${CATALOGO.size - faltando.length} de ${CATALOGO.size} anúncios`)
console.log(`  Faltando:    ${faltando.length}`)

if (faltando.length) {
  const lista = faltando.map(([id]) => `https://www.facebook.com/ads/library/?id=${id}`).join('\n')
  fs.writeFileSync(path.join(RAIZ, 'criativos-faltando.txt'), lista + '\n')
  console.log(`\n  Links do que falta → criativos-faltando.txt`)
  for (const [id, d] of faltando.slice(0, 8)) {
    console.log(`   ${d.adv} — ${d.proc}`)
    console.log(`   https://www.facebook.com/ads/library/?id=${id}`)
  }
}

console.log(`\n  Manifesto → src/criativos-manifesto.js\n`)
