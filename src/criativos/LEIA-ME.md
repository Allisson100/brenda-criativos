# Pasta de criativos

Os arquivos daqui são detectados automaticamente pelo Vite. Não precisa editar código.

**Não mexa nesta pasta na mão.** Quem escreve aqui é `npm run importar`, e ele também reescreve `src/criativos-manifesto.js` — que é o arquivo que diz ao site a ordem das peças de cada carrossel. Arquivo colocado ou renomeado à mão fica fora do manifesto e o site ignora.

## Regra de nome

```
1224081192964534.jpg      peça única
1224081192964534_1.jpg    peça 1 do carrossel
1224081192964534_5.mp4    peça 5, vídeo
```

O ID está no fim de cada link "Abrir anúncio":

```
https://www.facebook.com/ads/library/?id=1224081192964534
                                          |___ este ____|
```

## Formatos

`mp4` `webm` `mov` `gif` `jpg` `jpeg` `png` `webp`

## Para atualizar

```bash
npm run importar -- "C:\Users\allis\Downloads\videosTeste" --limpar
```

`--limpar` esvazia esta pasta antes de copiar. Use sempre que refizer o download inteiro — sem isso sobra arquivo de rodada antiga.

## Esta pasta é local

O `.gitignore` exclui tudo daqui (menos este arquivo e o `_demo.mp4`), então **o deploy sobe sem criativo nenhum** e os cards viram link para a Biblioteca. O README explica as duas saídas: deploy privado com a mídia junto, ou deploy público como índice navegável.

## `_demo.mp4`

Clipe de 5 segundos com o símbolo da Yarden, para o modo demonstração. Com 138 anúncios já preenchidos ele quase não tem mais uso — pode apagar, e o botão some junto.
