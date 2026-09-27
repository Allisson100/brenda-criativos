# Swipe File HOF · Yarden Lab

Referências de anúncio de harmonização orofacial organizadas por procedimento e por etapa de funil. 19 procedimentos, 141 criativos catalogados, coletados na Biblioteca de Anúncios da Meta em 26/09/2026.

Só entra **anúncio de serviço** — clínica ou profissional vendendo o procedimento ao paciente final. Nada de curso, formação, equipamento ou insumo.

## Rodar

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`.

```bash
npm run build     # gera dist/
npm run preview   # serve o dist/ localmente
```

---

## Os criativos

**138 dos 140 anúncios têm mídia no projeto: 408 peças no total** — 68 carrosséis e 70 peças únicas, 60 anúncios com vídeo. Faltam 2, listados em `criativos-faltando.txt`.

### Como a mídia é organizada

Um anúncio pode ter uma peça só ou um carrossel de várias. O nome do arquivo carrega o ID do anúncio e, quando é carrossel, o número da peça:

```
1224081192964534.jpg        peça única
1224081192964534_1.jpg      peça 1
1224081192964534_5.mp4      peça 5, vídeo
```

`src/criativos-manifesto.js` guarda a ordem das peças, o tipo e a dimensão de cada uma, mais quais anúncios rodam exatamente o mesmo criativo. **É gerado — não edite à mão.**

### Importador · `npm run importar`

```bash
npm run importar -- "C:\Users\allis\Downloads\videosTeste"
npm run importar -- "C:\Users\allis\Downloads\videosTeste" --limpar
```

O que ele faz:

1. varre a pasta e as subpastas atrás de vídeo e imagem
2. lê o ID e o número da peça no nome de cada arquivo
3. copia para `src/criativos/` só o que pertence ao swipe file
4. descarta peça repetida dentro do mesmo anúncio — a Meta às vezes devolve o primeiro card de novo no fim do carrossel
5. lê a dimensão de cada arquivo (JPEG, PNG, GIF, WebP e MP4) direto do cabeçalho, para a moldura do site sair na proporção certa
6. reescreve `src/criativos-manifesto.js`
7. grava `criativos-faltando.txt` com os links do que ainda falta

`--limpar` apaga o conteúdo de `src/criativos/` antes de copiar. Use quando refizer o download inteiro — sem isso, arquivo de uma rodada antiga fica para trás e o manifesto passa a apontar para mídia velha.

Nada é apagado nem movido na pasta de origem. Só cópia.

### URL hospedada · `src/midia.js`

Tem prioridade sobre o arquivo local. A chave é o ID do anúncio, o valor é uma URL ou uma lista de URLs:

```js
export const MIDIA_HOSPEDADA = {
  "1224081192964534": "https://cdn.yardenlab.com/swipe/1224081192964534.mp4",
  "1458569535619184": [
    "https://cdn.yardenlab.com/swipe/1458569535619184_1.jpg",
    "https://cdn.yardenlab.com/swipe/1458569535619184_2.mp4",
  ],
}
```

### Sem mídia

O card vira um botão que abre o anúncio na Biblioteca.

---

## O carrossel no site

- setas nas laterais, contador `3/19` sempre visível
- tira de miniaturas embaixo; peça de vídeo aparece como bloco escuro com ▶
- seta do teclado ‹ › navega quando a moldura está em foco
- arrastar para o lado funciona no celular
- ⤢ abre a peça ampliada; dentro dela as setas e o Esc também funcionam
- a moldura usa a proporção real da primeira peça — vertical 9:16 não fica com tarja

No topo, o botão **Só carrossel** filtra os anúncios com mais de uma peça.

Quando dois anúncios rodam o criativo idêntico, o card mostra **"Mesmo criativo rodando em outro anúncio"** com o link do irmão. São 10 anúncios em 5 pares — sinal de criativo que o anunciante decidiu escalar.

---

## Deploy na Vercel

| Campo | Valor |
|---|---|
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

Sem variável de ambiente, sem backend.

### Antes de subir, decida uma coisa

O `.gitignore` **exclui `src/criativos/`**. Do jeito que está, o deploy sobe sem nenhum criativo e os 138 cards viram botão "Ver na Biblioteca" — o site fica certo, mas vazio.

São 408 arquivos de outras clínicas, cerca de 55 MB. Consultar na Biblioteca é uma coisa; republicar num domínio público da Yarden é outra. Duas saídas:

**Deploy privado** — ligue Deployment Protection ou Password Protection na Vercel, comente estas linhas do `.gitignore` e suba a mídia junto:

```
src/criativos/*
!src/criativos/LEIA-ME.md
!src/criativos/.gitkeep
!src/criativos/_demo.mp4
```

**Deploy público** — deixe como está. O time usa a versão local (`npm run dev`) para estudar os criativos, e a versão publicada serve como índice navegável com link para cada anúncio.

O acervo local não depende do deploy: `npm run dev` mostra tudo.

---

## Identidade

Aplicada a partir do brandbook da Yarden Lab.

### Cores

| Token | Hex | Uso |
|---|---|---|
| Espresso | `#360F11` | Palavras, estrutura, o eixo |
| Cream | `#F3EBE2` | Página, papel, respiro |
| Vinho médio | `#6E3438` | Meio de funil, links, detalhe |
| Neutro | `#93837C` | Topo de funil, texto secundário |

Tema único, claro. **As etapas do funil não usam cores novas** — usam a própria paleta em profundidade crescente: neutro no topo, vinho médio no meio, espresso no fundo. O tom aprofunda conforme a intenção de compra aprofunda.

### Tipografia

**Segoe UI Variable** em todo o projeto. A hierarquia vem de peso, tamanho e espaçamento — não de troca de família. Arquivo em `src/fontes/`, carregado por `@font-face` local, sem Google Fonts.

> **Confira a licença da Segoe UI Variable antes de publicar.** Ela é distribuída com o Windows e o licenciamento da Microsoft normalmente não cobre incorporação como webfont em site público. O fallback já está na stack (`Segoe UI` → `system-ui`), então a página não quebra se você remover o arquivo — no Windows fica praticamente igual, já que a fonte está instalada no sistema.

### Símbolo

`src/marca/` tem as duas versões, cream sobre espresso e espresso sobre cream.

---

## Estrutura

```
src/
  data.js                   → criativos, análises, padrões e metodologia
  criativos-manifesto.js    → gerado: peças de cada anúncio, ordem, tipo, dimensão
  midia.js                  → URLs de criativo hospedado (tem prioridade)
  App.jsx                   → componentes, carrossel, lupa e filtros
  styles.css                → tokens da marca, tipografia, layout
  fontes/                   → Segoe UI Variable
  marca/                    → símbolo nas duas versões
  criativos/                → arquivos de mídia (fora do Git por padrão)
scripts/
  importar-criativos.mjs    → npm run importar
```

Para editar uma análise ou adicionar um criativo, mexa só em `data.js`:

| campo | uso |
|---|---|
| `id` | ID do anúncio (é o link, a chave da mídia e o nome do arquivo) |
| `adv` | nome do anunciante |
| `tag` | rótulo curto do ângulo |
| `hook` | o gancho, transcrito |
| `why` | por que funciona |
| `escala` | número de anúncios usando o mesmo criativo, segundo a Biblioteca |
| `destaque` | `true` marca como referência prioritária |
| `ressalva` | aviso de quando não copiar |
| `origem` | de qual busca veio, quando não foi a do próprio procedimento |

---

## Metodologia

A Biblioteca só divulga gasto e impressões de anúncio **político**. Para anúncio comercial não existe dado de performance público. A seleção usou sinais indiretos: criativo duplicado em vários conjuntos, tempo em veiculação, convergência entre anunciantes independentes e análise de estrutura de copy.

É um gerador de hipóteses, não um ranking comprovado. A seção "Metodologia e limites" dentro da página detalha onde cada sinal falha.
