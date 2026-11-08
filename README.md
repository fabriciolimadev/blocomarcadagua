# Assina — AE Carvalho

Aplicação em **Next.js + TypeScript** para preparar fotos para o Instagram em 1080 × 1350 (4:5), aplicar o modelo original AE Carvalho/FJU com vinheta e assinatura, baixar em ZIP ou compartilhar as imagens pelo celular.

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
2. Selecione cada foto no álbum e escolha o enquadramento: arraste a foto, use o zoom ou ajuste as posições horizontal e vertical. Cada imagem guarda seu próprio corte; **Centralizar corte** restaura posição e zoom dessa foto.
3. A vinheta e a assinatura vêm do modelo enviado, incluindo a margem original. Ajuste **Opacidade do modelo**, compare **Sem modelo / Com modelo** ou use **Ampliar**. A comparação mantém o mesmo corte.
4. Escolha JPG de alta qualidade ou PNG sem perdas.
5. Clique em **Preparar fotos**. Depois, escolha **Baixar ZIP** ou **Compartilhar fotos**. No menu de compartilhamento do celular, selecione o WhatsApp e os destinatários. As fotos são enviadas como arquivos individuais JPG/PNG, sem ZIP.

A opacidade e o formato de arquivo valem para todo o lote; o enquadramento é individual. Mudanças nas fotos, no corte ou nos ajustes invalidam os arquivos preparados. Nomes repetidos recebem prefixos únicos. Se alguma foto falhar, um aviso identifica os arquivos que ficaram fora do resultado.

O compartilhamento usa a [Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share) e depende do navegador, do aparelho e dos aplicativos instalados. Requer HTTPS (a Vercel fornece isso) e um clique após a preparação; acessar pelo IP local via HTTP normalmente não oferece essa função. O aplicativo confere se o lote pode ser compartilhado e mantém o ZIP como alternativa. Cancelar o menu não apaga as fotos. A aplicação não escolhe contatos nem confirma entrega ao WhatsApp.

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
- As fotos são processadas uma por vez, com orientação respeitada. A saída é sempre 1080 × 1350; o corte escolhido preenche o quadro sem deformar a imagem. O arquivo original não é modificado.
- As prévias são reduzidas para economizar memória. JPG é exportado com qualidade 95%; PNG preserva transparência. Metadados EXIF não são copiados para as imagens exportadas.
- Arquivos e ZIP ficam na memória da aba. Recarregar ou fechar a página limpa a sessão. Em aparelhos com pouca memória, use lotes menores.

## Assinatura e estrutura

O modelo em uso está em `public/instagram-template.png`, cópia integral do novo PNG 1080 × 1350 enviado pelo usuário. A aplicação sobrepõe o arquivo inteiro à foto, preservando o alfa, a textura da vinheta e a assinatura já incorporada; não desenha outra assinatura por cima. O antigo `public/watermark.png` foi preservado como arquivo de referência. Para substituir o modelo, use outro PNG transparente de 1080 × 1350.

- `src/app`: página, metadados e estilos globais.
- `src/components`: interface, controles e prévia.
- `src/hooks/use-photo-editor.ts`: seleção, estado do lote e exportação.
- `src/lib/geometry.ts`: quadro 4:5, zoom e retângulo de recorte individual.
- `src/lib/image-processing.ts`: leitura de fotos, Canvas, miniaturas e ZIP.
- `src/lib/sharing.ts`: compatibilidade e chamada do compartilhamento nativo.
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

Os testes de navegador verificam upload, modelo original sobreposto, exportação 1080 × 1350, enquadramento individual, ZIP, arquivos inválidos e responsividade. O limite nativo de compartilhamento é simulado para conferir os arquivos entregues à API e o cancelamento sem enviar mensagens reais. As telas de celular são emuladas; o envio no WhatsApp deve também ser conferido no aparelho de destino.
