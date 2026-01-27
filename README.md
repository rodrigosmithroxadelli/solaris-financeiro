# Solaris Financeiro - Sistema de Gestão Financeira

Sistema completo de gestão financeira e fluxo de caixa desenvolvido com Ionic/Angular, projetado especificamente para pequenos negócios como estética automotiva.

## 🚀 Funcionalidades

### ✅ Implementado

1. **Autenticação e Controle de Acesso**
   - Sistema de login com usuário e senha
   - Controle de permissões (Admin e Usuário)
   - Proteção de rotas com guards

2. **Gestão de Caixa**
   - Cadastro de entradas (vendas, serviços, recebimentos)
   - Cadastro de saídas (despesas fixas e variáveis)
   - Visualização do saldo atual em tempo real
   - Lista de transações com filtros por data e busca
   - Edição e exclusão de transações

3. **Relatórios**
   - Relatórios diários, semanais e mensais
   - Visualização por categoria
   - Visualização por forma de pagamento
   - Estatísticas e métricas
   - Exportação para PDF e Excel

4. **Administração**
   - Gerenciamento de usuários (apenas admin)
   - Criação, edição e exclusão de usuários
   - Controle de permissões

5. **Categorias Específicas para Estética Automotiva**
   - **Entradas**: Lavagem Simples, Higienização, Polimento, Vitrificação, Martelinho, Outros
   - **Saídas**: Produtos, Aluguel, Água/Luz, Pagamento Funcionário, Manutenção, Outros

6. **Formas de Pagamento**
   - PIX
   - Dinheiro
   - Cartão de Crédito
   - Cartão de Débito

## 📋 Pré-requisitos

- Node.js (versão 18 ou superior)
- npm ou yarn
- Ionic CLI: `npm install -g @ionic/cli`

## 🛠️ Instalação

1. Clone o repositório ou navegue até a pasta do projeto

2. Instale as dependências:
```bash
npm install
```

3. Execute o projeto:
```bash
ionic serve
```

O aplicativo estará disponível em `http://localhost:8100`

## 👤 Credenciais Padrão

Ao iniciar o aplicativo pela primeira vez, um usuário administrador é criado automaticamente:

- **Usuário**: `admin`
- **Senha**: `admin123`

⚠️ **IMPORTANTE**: Altere a senha padrão após o primeiro acesso!

## 📱 Estrutura do Aplicativo

### Telas Principais

1. **Início** (`/tabs/home`)
   - Dashboard com resumos do dia, semana e mês.
   - Visão geral rápida do desempenho financeiro.

2. **Caixa** (`/tabs/caixa`)
   - Visualização do saldo atual
   - Lista de todas as transações
   - Filtros por data e busca
   - Botão flutuante para adicionar nova transação

3. **Relatórios** (`/tabs/relatorios`)
   - Filtros por período (diário, semanal, mensal)
   - Gráficos por categoria e forma de pagamento
   - Estatísticas
   - Exportação PDF/Excel

4. **Administração** (`/tabs/admin`)
   - Apenas para administradores
   - Gerenciamento de usuários
   - Informações do usuário atual
   - Logout

## 🗂️ Estrutura de Pastas

```
src/app/
├── Admin/              # Tela de administração
├── Caixa/              # Tela principal de caixa
├── Relatórios/         # Tela de relatórios
├── components/          # Componentes reutilizáveis
│   └── add-transaction-modal/
├── guards/              # Guards de rota
│   └── auth.guard.ts
├── login/               # Página de login
├── models/              # Modelos de dados
│   ├── transaction.model.ts
│   └── user.model.ts
├── services/            # Serviços
│   ├── auth.service.ts
│   ├── finance.service.ts
│   ├── storage.service.ts
│   └── export.service.ts
└── tabs/                # Componente de tabs
```

## 💾 Armazenamento

O aplicativo utiliza **localStorage** para armazenar dados localmente no navegador. Os dados são salvos automaticamente e persistem entre sessões.

### Chaves de Armazenamento

- `solaris_users`: Lista de usuários
- `solaris_transactions`: Lista de transações
- `solaris_current_user`: Usuário logado atualmente

## 🔒 Segurança

⚠️ **Nota de Segurança**: Este é um aplicativo de demonstração. Para uso em produção:

1. Implemente hash de senhas (bcrypt, argon2, etc.)
2. Use um backend seguro com autenticação JWT
3. Implemente validação de dados no servidor
4. Use HTTPS para todas as comunicações
5. Implemente backup automático dos dados

## 🚧 Melhorias Futuras

- [ ] Integração com backend (API REST)
- [ ] Sincronização em nuvem
- [ ] Notificações push
- [ ] Gráficos mais avançados (Chart.js)
- [ ] Exportação PDF/Excel melhorada (jsPDF, xlsx)
- [ ] Backup automático
- [ ] Modo offline completo
- [ ] PWA (Progressive Web App)
- [ ] App mobile nativo (Capacitor)

## 📝 Licença

Este projeto é um exemplo educacional e pode ser usado livremente.

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues ou pull requests.

## 📧 Suporte

Para dúvidas ou problemas, abra uma issue no repositório.

---

Desenvolvido com ❤️ usando Ionic e Angular
