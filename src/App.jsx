import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { PROCEDIMENTOS, GRUPOS, ETAPAS, PADROES, METODOLOGIA, COLETA, TOTAL_CRIATIVOS } from './data.js'
import { MIDIA_HOSPEDADA } from './midia.js'
import simbolo from './marca/yarden-simbolo-escuro.png'

/* ------------------------------------------------------------------ *
 * Mídia
 *
 * Um anúncio pode ter uma peça só ou um carrossel de várias.
 * Os arquivos são nomeados pelo ID do anúncio:
 *
 *   1234567890123.jpg      peça única
 *   1234567890123_1.jpg    peça 1 do carrossel
 *   1234567890123_5.mp4    peça 5, vídeo
 *
 * A ordem, o tipo e a dimensão vêm de criativos-manifesto.js, escrito
 * por `npm run importar`. Sem manifesto, o nome do arquivo basta.
 * ------------------------------------------------------------------ */

const arquivos = import.meta.glob('./criativos/*.{mp4,webm,mov,gif,jpg,jpeg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
})

// manifesto é opcional — o site funciona sem ele
let PECAS = {}
let GEMEOS = {}
try {
  const m = import.meta.glob('./criativos-manifesto.js', { eager: true })
  const mod = Object.values(m)[0]
  if (mod) {
    PECAS = mod.PECAS || {}
    GEMEOS = mod.GEMEOS || {}
  }
} catch {}

const VIDEO = ['mp4', 'webm', 'mov']
const extDe = (nome) => nome.split('?')[0].split('.').pop().toLowerCase()
const tipoDe = (nome) => (VIDEO.includes(extDe(nome)) ? 'video' : 'imagem')

const URL_POR_ARQUIVO = Object.fromEntries(
  Object.entries(arquivos).map(([caminho, url]) => [caminho.split('/').pop(), url])
)

/** "1234567890123_3.jpg" → { id, peca } */
function lerNome(nome) {
  const base = nome.slice(0, nome.lastIndexOf('.'))
  const m = base.match(/^(\d{10,})(?:[_-](\d+))?$/)
  if (m) return { id: m[1], peca: m[2] ? Number(m[2]) : 1 }
  const solto = base.match(/\d{10,}/)
  return solto ? { id: solto[0], peca: 1 } : null
}

/** id do anúncio → lista ordenada de peças */
const MIDIA = (() => {
  const mapa = {}

  // 1. o manifesto manda na ordem
  for (const [id, lista] of Object.entries(PECAS)) {
    const pecas = lista
      .filter((p) => URL_POR_ARQUIVO[p.a])
      .map((p) => ({ url: URL_POR_ARQUIVO[p.a], tipo: p.t === 'video' ? 'video' : 'imagem', w: p.w, h: p.h }))
    if (pecas.length) mapa[id] = pecas
  }

  // 2. arquivos sem manifesto entram pelo nome
  const soltos = {}
  for (const nome of Object.keys(URL_POR_ARQUIVO)) {
    const lido = lerNome(nome)
    if (!lido || mapa[lido.id]) continue
    if (!soltos[lido.id]) soltos[lido.id] = []
    soltos[lido.id].push({ peca: lido.peca, url: URL_POR_ARQUIVO[nome], tipo: tipoDe(nome) })
  }
  for (const [id, lista] of Object.entries(soltos)) {
    mapa[id] = lista.sort((a, b) => a.peca - b.peca).map(({ url, tipo }) => ({ url, tipo }))
  }

  return mapa
})()

const CLIPE_DEMO = URL_POR_ARQUIVO['_demo.mp4']

function pecasDe(id) {
  const hospedado = MIDIA_HOSPEDADA[id]
  if (hospedado) {
    const lista = Array.isArray(hospedado) ? hospedado : [hospedado]
    return lista.map((url) => ({ url, tipo: tipoDe(url) }))
  }
  return MIDIA[id] || null
}

const linkAnuncio = (id) => `https://www.facebook.com/ads/library/?id=${id}`
const ETAPAS_ORDEM = ['topo', 'meio', 'fundo']

/** Proporção da moldura: a da primeira imagem, dentro de limites sãos. */
function proporcao(pecas) {
  const comDim = pecas.find((p) => p.w && p.h)
  if (!comDim) return '4 / 5'
  const r = comDim.w / comDim.h
  if (r < 0.62) return '9 / 16'
  if (r > 1.45) return '16 / 9'
  return `${comDim.w} / ${comDim.h}`
}

/* ------------------------------------------------------------------ *
 * Lupa — uma só, no topo da árvore
 * ------------------------------------------------------------------ */
const Lupa = createContext(() => {})

function Visor({ peca, alt, controles = true }) {
  if (!peca) return null
  // Sem poster, o vídeo parado fica um retângulo preto. Assim que os
  // metadados chegam, avançamos uma fração de segundo: o navegador pinta
  // esse quadro e o criativo aparece antes de alguém dar play.
  const primeiroQuadro = (e) => {
    const v = e.currentTarget
    if (v.currentTime < 0.05) {
      try { v.currentTime = 0.1 } catch {}
    }
  }

  return peca.tipo === 'video' ? (
    <video
      src={peca.url}
      controls={controles}
      preload="metadata"
      playsInline
      onLoadedMetadata={primeiroQuadro}
    />
  ) : (
    <img src={peca.url} alt={alt} loading="lazy" decoding="async" />
  )
}

function Carrossel({ criativo, pecas, aoAmpliar }) {
  const [i, setI] = useState(0)
  const toque = useRef(null)
  const total = pecas.length
  const atual = pecas[Math.min(i, total - 1)]
  const ir = (n) => setI(((n % total) + total) % total)

  const estilo = { aspectRatio: proporcao(pecas) }
  const alt = `Criativo de ${criativo.adv}, peça ${i + 1} de ${total}`

  if (total === 1) {
    return (
      <div className="media" style={estilo}>
        <button
          className="media__lente"
          onClick={() => aoAmpliar(pecas, 0)}
          title="Ampliar"
          aria-label="Ampliar criativo"
        >
          ⤢
        </button>
        <Visor peca={atual} alt={`Criativo de ${criativo.adv}`} />
      </div>
    )
  }

  return (
    <div className="carrossel">
      <div
        className="media media--carrossel"
        style={estilo}
        tabIndex={0}
        role="group"
        aria-label={`Carrossel com ${total} peças`}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') { e.preventDefault(); ir(i - 1) }
          if (e.key === 'ArrowRight') { e.preventDefault(); ir(i + 1) }
        }}
        onTouchStart={(e) => (toque.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (toque.current == null) return
          const d = e.changedTouches[0].clientX - toque.current
          if (Math.abs(d) > 40) ir(d < 0 ? i + 1 : i - 1)
          toque.current = null
        }}
      >
        <Visor peca={atual} alt={alt} />

        <span className="media__contador">
          {i + 1}/{total}
        </span>

        <button className="media__lente" onClick={() => aoAmpliar(pecas, i)} title="Ampliar" aria-label="Ampliar peça">
          ⤢
        </button>

        <button className="media__seta media__seta--ant" onClick={() => ir(i - 1)} aria-label="Peça anterior">
          ‹
        </button>
        <button className="media__seta media__seta--prox" onClick={() => ir(i + 1)} aria-label="Próxima peça">
          ›
        </button>
      </div>

      <div className="tiras" role="tablist" aria-label="Peças do carrossel">
        {pecas.map((p, n) => (
          <button
            key={n}
            className={`tira${n === i ? ' tira--on' : ''}`}
            onClick={() => setI(n)}
            role="tab"
            aria-selected={n === i}
            aria-label={`Peça ${n + 1}${p.tipo === 'video' ? ', vídeo' : ''}`}
          >
            {p.tipo === 'video' ? (
              <span className="tira__video" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                  <path d="M8 5.5v13l11-6.5z" />
                </svg>
              </span>
            ) : (
              <img src={p.url} alt="" loading="lazy" decoding="async" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

function Media({ criativo, demo }) {
  const aoAmpliar = useContext(Lupa)
  const pecas = pecasDe(criativo.id)

  if (pecas && pecas.length) {
    return <Carrossel criativo={criativo} pecas={pecas} aoAmpliar={aoAmpliar} />
  }

  if (demo && CLIPE_DEMO) {
    return (
      <div className="media" style={{ aspectRatio: '4 / 5' }}>
        <span className="media__etiqueta">Demonstração</span>
        <video src={CLIPE_DEMO} controls muted loop preload="metadata" playsInline />
      </div>
    )
  }

  return (
    <a
      className="media media--vazia"
      href={linkAnuncio(criativo.id)}
      target="_blank"
      rel="noreferrer"
    >
      <span className="media__play" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="21" height="21" fill="currentColor">
          <path d="M8 5.5v13l11-6.5z" />
        </svg>
      </span>
      <span className="media__txt">Ver o criativo na Biblioteca</span>
    </a>
  )
}

function Ampliada({ estado, fechar }) {
  const { pecas, indice } = estado
  const [i, setI] = useState(indice)
  const total = pecas.length
  const ir = (n) => setI(((n % total) + total) % total)

  useEffect(() => {
    const tecla = (e) => {
      if (e.key === 'Escape') fechar()
      if (e.key === 'ArrowLeft') ir(i - 1)
      if (e.key === 'ArrowRight') ir(i + 1)
    }
    window.addEventListener('keydown', tecla)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', tecla)
      document.body.style.overflow = ''
    }
  }, [i, total])

  return (
    <div className="lupa" onClick={fechar} role="dialog" aria-modal="true" aria-label="Criativo ampliado">
      <div className="lupa__quadro" onClick={(e) => e.stopPropagation()}>
        <Visor peca={pecas[i]} alt={`Peça ${i + 1} de ${total}`} />
      </div>

      <button className="lupa__x" onClick={fechar} aria-label="Fechar">
        ×
      </button>

      {total > 1 && (
        <>
          <button
            className="lupa__seta lupa__seta--ant"
            onClick={(e) => { e.stopPropagation(); ir(i - 1) }}
            aria-label="Peça anterior"
          >
            ‹
          </button>
          <button
            className="lupa__seta lupa__seta--prox"
            onClick={(e) => { e.stopPropagation(); ir(i + 1) }}
            aria-label="Próxima peça"
          >
            ›
          </button>
          <span className="lupa__contador">
            {i + 1} de {total}
          </span>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function Card({ criativo, etapa, demo }) {
  const pecas = pecasDe(criativo.id)
  const gemeos = GEMEOS[criativo.id]

  return (
    <article className={`card card--${etapa}${criativo.destaque ? ' card--destaque' : ''}`}>
      <Media criativo={criativo} demo={demo} />

      <div className="card__corpo">
        <header className="card__topo">
          <h4 className="card__adv">{criativo.adv}</h4>
          <span className="card__selos">
            {pecas && pecas.length > 1 && (
              <span className="selo selo--formato" title="Carrossel: quantidade de peças do anúncio">
                carrossel · {pecas.length}
              </span>
            )}
            {criativo.escala > 1 && (
              <span className="selo" title="Anúncios usando este mesmo criativo e texto">
                ×{criativo.escala} escalado
              </span>
            )}
          </span>
        </header>

        {criativo.tag && <p className="card__tag">{criativo.tag}</p>}

        <blockquote className="card__hook">{criativo.hook}</blockquote>

        <p className="card__why">{criativo.why}</p>

        {criativo.ressalva && (
          <p className="card__ressalva">
            <strong>Ressalva</strong>
            {criativo.ressalva}
          </p>
        )}

        {gemeos && gemeos.length > 0 && (
          <p className="card__gemeo">
            Mesmo criativo rodando em {gemeos.length === 1 ? 'outro anúncio' : `outros ${gemeos.length} anúncios`}:{' '}
            {gemeos.map((g, n) => (
              <span key={g}>
                {n > 0 && ', '}
                <a href={linkAnuncio(g)} target="_blank" rel="noreferrer">
                  {g}
                </a>
              </span>
            ))}
          </p>
        )}

        <footer className="card__rodape">
          {criativo.origem && <span className="card__origem">busca: {criativo.origem}</span>}
          <a className="card__link" href={linkAnuncio(criativo.id)} target="_blank" rel="noreferrer">
            Abrir anúncio
          </a>
        </footer>
      </div>
    </article>
  )
}

function Faixa({ etapa, criativos, demo }) {
  if (!criativos.length) return null
  return (
    <section className={`faixa faixa--${etapa}`}>
      <div className="faixa__cab">
        <span className="faixa__pill">{ETAPAS[etapa].nome}</span>
        <span className="faixa__regua" />
      </div>
      <div className="grade">
        {criativos.map((c) => (
          <Card key={`${etapa}-${c.id}`} criativo={c} etapa={etapa} demo={demo} />
        ))}
      </div>
    </section>
  )
}

function Procedimento({ proc, visiveis, aberto, alternar, demo }) {
  const total = ETAPAS_ORDEM.reduce((n, e) => n + visiveis[e].length, 0)
  if (!total) return null

  return (
    <section className={`proc${aberto ? ' proc--aberto' : ''}`} id={proc.id}>
      <button className="proc__botao" onClick={() => alternar(proc.id)} aria-expanded={aberto}>
        <span className="proc__seta" aria-hidden="true">
          ▶
        </span>
        <h2 className="proc__nome">{proc.nome}</h2>
        <span className="proc__ativos">{proc.ativos} ativos</span>
        <span className="proc__barras">
          {ETAPAS_ORDEM.map((e) =>
            visiveis[e].length ? (
              <span key={e} className={`proc__barra proc__barra--${e}`} title={`${ETAPAS[e].nome} de funil`}>
                {visiveis[e].length}
              </span>
            ) : null
          )}
        </span>
      </button>

      {aberto && (
        <div className="proc__conteudo">
          {proc.nota && <p className="proc__nota">{proc.nota}</p>}
          <a className="proc__busca" href={proc.busca} target="_blank" rel="noreferrer">
            Abrir a busca na Biblioteca ↗
          </a>
          {ETAPAS_ORDEM.map((e) => (
            <Faixa key={e} etapa={e} criativos={visiveis[e]} demo={demo} />
          ))}
        </div>
      )}
    </section>
  )
}

function Bloco({ id, titulo, aberto, alternar, children }) {
  return (
    <section className="bloco" id={id}>
      <button className="bloco__botao" onClick={() => alternar(id)} aria-expanded={aberto}>
        <span className="proc__seta" aria-hidden="true">
          ▶
        </span>
        <h2 className="bloco__titulo">{titulo}</h2>
      </button>
      {aberto && <div className="bloco__conteudo">{children}</div>}
    </section>
  )
}

/* ------------------------------------------------------------------ */

export default function App() {
  const [termo, setTermo] = useState('')
  const [etapas, setEtapas] = useState(['topo', 'meio', 'fundo'])
  const [abertos, setAbertos] = useState(() => new Set())
  const [demo, setDemo] = useState(false)
  const [soCarrossel, setSoCarrossel] = useState(false)
  const [lupa, setLupa] = useState(null)

  const abrirLupa = (pecas, indice) => setLupa({ pecas, indice })

  const alternar = (id) =>
    setAbertos((s) => {
      const novo = new Set(s)
      novo.has(id) ? novo.delete(id) : novo.add(id)
      return novo
    })

  const alternaEtapa = (e) =>
    setEtapas((atual) =>
      atual.includes(e) ? (atual.length === 1 ? atual : atual.filter((x) => x !== e)) : [...atual, e]
    )

  const filtrados = useMemo(() => {
    const t = termo.trim().toLowerCase()
    const bate = (c) => {
      if (soCarrossel) {
        const p = pecasDe(c.id)
        if (!p || p.length < 2) return false
      }
      return (
        !t ||
        c.adv.toLowerCase().includes(t) ||
        c.hook.toLowerCase().includes(t) ||
        c.why.toLowerCase().includes(t) ||
        (c.tag || '').toLowerCase().includes(t)
      )
    }

    return PROCEDIMENTOS.map((p) => ({
      proc: p,
      visiveis: Object.fromEntries(
        ETAPAS_ORDEM.map((e) => [e, etapas.includes(e) ? p[e].filter(bate) : []])
      ),
    })).filter((x) => ETAPAS_ORDEM.some((e) => x.visiveis[e].length))
  }, [termo, etapas, soCarrossel])

  useEffect(() => {
    if (termo.trim() || soCarrossel) setAbertos(new Set(filtrados.map((x) => x.proc.id)))
  }, [termo, soCarrossel, filtrados])

  const tudoAberto = abertos.size >= filtrados.length && filtrados.length > 0
  const abrirFechar = () => setAbertos(tudoAberto ? new Set() : new Set(filtrados.map((x) => x.proc.id)))

  const encontrados = filtrados.reduce(
    (n, x) => n + ETAPAS_ORDEM.reduce((m, e) => m + x.visiveis[e].length, 0),
    0
  )

  // panorama do acervo, calculado uma vez
  const acervo = useMemo(() => {
    const ids = new Set()
    for (const p of PROCEDIMENTOS) for (const e of ETAPAS_ORDEM) for (const c of p[e]) ids.add(c.id)
    let comMidia = 0, carrosseis = 0, pecas = 0, videos = 0
    for (const id of ids) {
      const lista = pecasDe(id)
      if (!lista || !lista.length) continue
      comMidia++
      pecas += lista.length
      if (lista.length > 1) carrosseis++
      if (lista.some((p) => p.tipo === 'video')) videos++
    }
    return { total: ids.size, comMidia, carrosseis, pecas, videos }
  }, [])

  const Simbolo = (
    <span className="marca__brasao" aria-hidden="true">
      <img className="marca__simbolo" src={simbolo} alt="" />
    </span>
  )

  return (
    <Lupa.Provider value={abrirLupa}>
      <div className="app">
        <header className="cabecalho">
          <div className="cabecalho__linha">
            <div className="marca">
              {Simbolo}
              <div>
                <h1 className="marca__nome">Swipe File HOF</h1>
                <p className="marca__sub">
                  Yarden Lab · {TOTAL_CRIATIVOS} criativos · {PROCEDIMENTOS.length} procedimentos
                </p>
              </div>
            </div>

            <div className="controles">
              <input
                id="busca"
                className="busca"
                type="search"
                placeholder="Buscar anunciante ou gancho…"
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
              />
              <div className="chips" role="group" aria-label="Filtrar por etapa do funil">
                {ETAPAS_ORDEM.map((e) => (
                  <button
                    key={e}
                    className={`chip${etapas.includes(e) ? ' chip--on' : ''}`}
                    onClick={() => alternaEtapa(e)}
                    aria-pressed={etapas.includes(e)}
                  >
                    {ETAPAS[e].nome}
                  </button>
                ))}
              </div>
              <button
                className={`chip${soCarrossel ? ' chip--on' : ''}`}
                onClick={() => setSoCarrossel((v) => !v)}
                aria-pressed={soCarrossel}
                title="Mostrar só anúncios com mais de uma peça"
              >
                Só carrossel
              </button>
              <button className="btn-texto" onClick={abrirFechar}>
                {tudoAberto ? 'Fechar tudo' : 'Abrir tudo'}
              </button>
              {CLIPE_DEMO && (
                <button className="btn-texto" onClick={() => setDemo((v) => !v)}>
                  {demo ? 'Sair da demonstração' : 'Modo demonstração'}
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="corpo">
          <section className="abertura">
            <p className="abertura__lead">
              Referências de anúncio de serviço, por procedimento e por etapa de funil.
            </p>

            <p className="abertura__acervo">
              {acervo.comMidia} de {acervo.total} anúncios com criativo no projeto · {acervo.pecas} peças ·{' '}
              {acervo.carrosseis} carrosséis · {acervo.videos} com vídeo
            </p>

            <div className="legenda">
              {ETAPAS_ORDEM.map((e) => (
                <div className={`legenda__item legenda__item--${e}`} key={e}>
                  <span className="legenda__nome">{ETAPAS[e].nome}</span>
                  <p className="legenda__txt">{ETAPAS[e].trabalho}</p>
                </div>
              ))}
            </div>
          </section>

          {(termo.trim() || soCarrossel) && (
            <p className="marca__sub">
              {encontrados} criativo{encontrados === 1 ? '' : 's'}
              {termo.trim() ? ` para “${termo.trim()}”` : ' com mais de uma peça'}
            </p>
          )}

          {filtrados.length === 0 && <p className="vazio">Nada encontrado.</p>}

          {GRUPOS.map((g) => {
            const doGrupo = filtrados.filter((x) => x.proc.grupo === g.id)
            if (!doGrupo.length) return null
            return (
              <div className="grupo" key={g.id}>
                <h2 className="grupo__nome">{g.nome}</h2>
                {doGrupo.map(({ proc, visiveis }) => (
                  <Procedimento
                    key={proc.id}
                    proc={proc}
                    visiveis={visiveis}
                    aberto={abertos.has(proc.id)}
                    alternar={alternar}
                    demo={demo}
                  />
                ))}
              </div>
            )
          })}

          <div className="grupo">
            <h2 className="grupo__nome">Leitura</h2>

            <Bloco id="padroes" titulo="Padrões que se repetem" aberto={abertos.has('padroes')} alternar={alternar}>
              <div className="padroes">
                {PADROES.map((p, i) => (
                  <article className="padrao" key={i}>
                    <h3>{p.titulo}</h3>
                    <p>{p.texto}</p>
                  </article>
                ))}
              </div>
            </Bloco>

            <Bloco
              id="metodologia"
              titulo="Metodologia e limites"
              aberto={abertos.has('metodologia')}
              alternar={alternar}
            >
              <p className="aviso">{METODOLOGIA.aviso}</p>

              <div className="sinais">
                {METODOLOGIA.sinais.map((s, i) => (
                  <article className="sinal" key={i}>
                    <h3>{s.nome}</h3>
                    <p>{s.desc}</p>
                    <p className="sinal__limite">
                      <strong>Onde falha:</strong> {s.limite}
                    </p>
                  </article>
                ))}
              </div>

              <p className="bloco__conclusao">{METODOLOGIA.conclusao}</p>

              <table className="tabela">
                <thead>
                  <tr>
                    <th>Etapa</th>
                    <th>O que medir quando rodar</th>
                  </tr>
                </thead>
                <tbody>
                  {METODOLOGIA.metricas.map((m) => (
                    <tr key={m.etapa}>
                      <th scope="row">{m.etapa}</th>
                      <td>{m.medir}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Bloco>
          </div>

          <footer className="rodape">
            {Simbolo}
            <p>
              Yarden Lab · Biblioteca de Anúncios da Meta · Brasil · anúncios ativos · coleta de {COLETA}. Os textos
              citados pertencem aos respectivos anunciantes e estão aqui como referência de pesquisa.
            </p>
          </footer>
        </main>

        {lupa && <Ampliada estado={lupa} fechar={() => setLupa(null)} />}
      </div>
    </Lupa.Provider>
  )
}
