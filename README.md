# BET7NET (jogo fictício)

1. Crie um projeto em console.firebase.google.com e adicione um App Web.
2. Cole o firebaseConfig e o ADMIN_EMAIL em `firebase-config.js`.
3. Ative Authentication > E-mail/senha e crie o Firestore.
4. Cole `firestore.rules` na aba Regras (troque o e-mail do admin nele também).
5. Publique: `firebase init hosting` (use a pasta atual, NÃO sobrescreva index.html) e `firebase deploy`.
   Alternativa: arraste a pasta no Netlify.
6. Crie sua conta no site com o e-mail do admin para liberar a aba Admin.

7. Contas novas começam com saldo 0. Na aba Admin > Contas e saldos você define ou soma o saldo de cada pessoa.
8. Atualização: se já usa o site, cole o novo firestore.rules na aba Regras e rode firebase deploy de novo.
9. Página `live.html` (botão 📺 Ao vivo): ranking ao vivo dos times mais apostados + transmissão. Logado como admin, cole o link da live ali e clique em Salvar link (YouTube e Twitch funcionam; a live precisa permitir incorporação).
