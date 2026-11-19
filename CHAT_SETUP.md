# Configuração do atendimento comercial

O chat usa a função serverless `api/send-request.js` e o serviço Resend. O projeto original é estático e não inclui backend; para usar este endpoint, publique o diretório do site em um projeto Vercel.

1. Verifique um domínio de envio no Resend e gere uma chave de API.
2. Na configuração do projeto Vercel, adicione estas variáveis de ambiente:
   - `RESEND_API_KEY`: chave de API do Resend.
   - `RESEND_FROM_EMAIL`: remetente permitido pelo domínio verificado, por exemplo `Site Transcarapia <site@seudominio.com.br>`.
   - `SALES_REQUEST_TO_EMAIL`: caixa comercial de destino (`transcarapia@transcarapia.com.br`).
3. Faça um novo deploy após salvar as variáveis.
4. No site publicado, envie uma solicitação de teste e confirme a chegada na caixa de entrada comercial.

As credenciais ficam somente nas variáveis do backend. O endpoint valida a origem da chamada e os campos, limita o tamanho do corpo, usa um campo honeypot e aplica limite de tentativas por IP em cada instância ativa da função. Como esse limite em memória não é compartilhado entre instâncias serverless, configure também a proteção contra abuso/rate limiting da hospedagem para produção.

O envio real não pode ser verificado antes da publicação com as credenciais do Resend configuradas.
