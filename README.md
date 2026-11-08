# Assina — AE Carvalho

Aplicação em **Next.js + TypeScript** para selecionar fotos do celular ou computador, aplicar a assinatura AE Carvalho/FJU e baixar as imagens em ZIP.

As fotos são processadas no navegador. Não existe upload para um servidor, banco de dados, login ou dependência de APIs pagas. A versão de produção é estática e pode ser hospedada na Vercel.

## Rodar no computador

Use Node.js 22.13 ou superior (verificado com Node.js 24).

```bash
npm ci
npm run dev
```

Abra [localhost:3000](http://localhost:3000). Para testar pelo celular na mesma rede, use o endereço IP do computador seguido de `:3000`.

## Como usar

1. Toque em **Selecionar fotos** ou arraste os arquivos para a área de seleção.
2. Ajuste tamanho, margem e opacidade. A assinatura permanece no canto inferior esquerdo; a margem mínima evita encostar na borda.
3. Confira cada foto no álbum. Use **Original / Com marca** para comparar ou **Ampliar** para uma prévia maior.
4. Escolha JPG de alta qualidade ou PNG sem perdas.
5. Clique em **Preparar fotos para baixar**. Quando terminar, clique em **Baixar ZIP**. O segundo clique mantém o download compatível com as restrições de gesto do navegador móvel.

Os ajustes valem para todo o lote. Mudanças nas fotos ou nos ajustes invalidam o ZIP anterior. Arquivos de mesmo nome recebem prefixos únicos. Se alguma foto falhar, um aviso identifica os arquivos que ficaram fora do resultado.

## Publicar na Vercel

1. Envie este projeto para um repositório no GitHub, GitLab ou Bitbucket.
2. Na [Vercel](https://vercel.com/new), importe o repositório e selecione o preset **Next.js**.
3. Mantenha o comando de instalação padrão e **Build Command: `npm run build`**. O projeto usa `output: "export"`; o Next.js gera o conteúdo estático em `out/`.
4. Clique em **Deploy**. Não é necessário configurar variáveis de ambiente, armazenamento ou banco.

O [plano Hobby da Vercel](https://vercel.com/docs/plans/hobby) é gratuito dentro de suas cotas e destinado a uso pessoal/não comercial. O processamento das fotos ocorre no aparelho do visitante e não consome funções de servidor.

Para conferir o build de produção localmente:

```bash
npm run build
npm start
```

## Formatos e limites

- Entrada: JPG/JPEG, PNG e WebP. Converta HEIC/HEIF para JPG antes de selecionar.
- Até 50 fotos por lote, 30 MB por arquivo e 300 MB no total.
- Até 8192 pixels por lado e 16.777.216 pixels por imagem, para limitar o uso de memória em celulares. Fotos maiores recebem uma mensagem para redimensionar.
- As fotos são processadas uma por vez, com orientação respeitada. A saída mantém as dimensões da foto; o original não é modificado.
- As prévias são reduzidas para economizar memória. JPG é exportado com qualidade 95%; PNG preserva transparência. Metadados EXIF não são copiados para as imagens exportadas.
- Arquivos e ZIP ficam na memória da aba. Recarregar ou fechar a página limpa a sessão. Em aparelhos com pouca memória, use lotes menores.

## Assinatura e estrutura

O arquivo original fornecido está em `public/watermark.png`. A aplicação detecta os limites do conteúdo visível pelo canal alfa e ignora apenas o espaço transparente externo, preservando cores, texto e proporção. Para trocar a assinatura no futuro, substitua esse PNG e publique novamente.

- `src/app`: página, metadados e estilos globais.
- `src/components`: interface, controles e prévia.
- `src/hooks/use-photo-editor.ts`: seleção, estado do lote e exportação.
- `src/lib/geometry.ts`: tamanho, posição e limites da marca.
- `src/lib/image-processing.ts`: leitura de fotos, Canvas, miniaturas e ZIP.
- `tests/editor.spec.ts`: verificação integrada em desktop e viewport de celular.

A [foto de demonstração](https://images.unsplash.com/photo-1464822759023-fed622ff2c3b) vem do Unsplash e está incluída localmente; as fotos do usuário nunca são enviadas ao Unsplash. Fonte Manrope e ícones Lucide também são servidos localmente.

## Verificação

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Com o servidor de desenvolvimento rodando em outra janela e Google Chrome instalado:

```bash
npm run test:e2e
```

Os testes de navegador verificam upload, prévia, dimensões exportadas, assinatura no canto inferior esquerdo, conteúdo do ZIP, rejeição de arquivos inválidos e responsividade. A viewport móvel é emulada no Chrome; recomenda-se também conferir o download no próprio aparelho de destino.
