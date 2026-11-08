# Instagram, enquadramento e compartilhamento

Objetivo: aplicar o novo modelo de 1080 × 1350 enviado pelo usuário, permitir corte individual e compartilhar as imagens pelo menu nativo do celular. Em seguida, enviar ao repositório autorizado e publicar na Vercel Hobby.

Referência: `public/instagram-template.png`, cópia integral de `[ASSINATURAS] AE CARVALHO.png`. Manter toda a transparência, a vinheta com textura e a assinatura incorporada. Não redesenhar a vinheta nem duplicar a assinatura antiga.

- Exportação fixa 1080 × 1350 (4:5), com enquadramento sem deformação e ajustes individuais de posição e zoom.
- Prévia e Canvas usam o mesmo retângulo de recorte. Arrastar, setas do teclado e controles acessíveis oferecem os mesmos ajustes.
- Preparar as imagens antes do gesto de compartilhar. Enviar arquivos JPG/PNG via Web Share API; o usuário escolhe WhatsApp e destinatários. Manter ZIP quando compartilhamento não é compatível.
- Conferir arquivos exportados, camada de modelo, corte, estado independente por foto e fluxo de compartilhamento com teste da integração do navegador, sem enviar mensagens reais.
- Validar desktop, tablet e celular, executar testes/build/lint, revisar o diff do repositório antes do push e verificar a publicação.
