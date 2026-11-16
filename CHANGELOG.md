# Changelog

Histórico de mudanças do Atlas (em português).

# Atlas — worldbuilding offline (Fase 1)

## Rodar em desenvolvimento
    npm install
    npm run dev

## Gerar o .exe (rode no Windows)
    npm install
    npm run build
O instalador sai em `dist/`.

Dados ficam em `%APPDATA%/atlas-local/dados/` (atlas.db e pasta media/).
Coloque um `icon.ico` (256x256) em `resources/` antes do build.

## Fase 2 — Cards
Depois de copiar os arquivos novos por cima do projeto, rode `npm install` (há novas dependências do TipTap) e `npm run dev`.

## Fase 3 — Biblioteca de mídia
Sem novas dependências: basta copiar os arquivos por cima e rodar `npm run dev`.
Arquivos importados ficam em `%APPDATA%/<app>/dados/media/<id-do-mundo>/`.

## Fase 3.1 — Importar de link
Biblioteca de mídia → "Importar de link" (também no seletor de imagem). O app baixa o arquivo e guarda uma cópia local.

## Fase 4 — Mapas
Sem novas dependências. Migração automática do banco (versão 2: campo de notas nos elementos).
- Crie um mapa com a imagem da biblioteca (botão + em "Mapas" na barra lateral).
- Ferramentas: Selecionar (V), Pin (P), Região (R), Zona (Z), Texto (T).
- Região/zona: clique para adicionar vértices; Enter, duplo clique ou clique perto do primeiro ponto conclui; Esc cancela.
- Duplo clique em um elemento abre os detalhes (notas, card vinculado, submapa).
- Zona ou região com submapa: abra pelos detalhes ou pelo painel.
- Delete apaga o elemento selecionado. Espaço + arrastar (ou botão do meio) move a visão.

## Fase 5 — Linhas do tempo e eras
Migração automática do banco (versão 3: tabela de versões do mundo). Sem novas dependências.
- Crie uma linha do tempo em "Linhas do tempo" na barra lateral.
- Eras: intervalos com nome e cor. Ajuste início e fim no painel direito.
- Eventos: clique na linha do tempo para criar um evento. Título, data livre, posição numérica (define a ordem e a distância), era, versão, descrição e card vinculado.
- Versões: alternativas do mesmo mundo. Escolha a versão no topo; eventos de outras versões ficam ocultos.
- Modo Lista: mesma informação em tabela, ordenada pela posição.
- Card: o painel "Aparece em linhas do tempo" leva direto ao evento.

## Fase 6 — Quadros e árvores de relações
Sem novas dependências e sem migração nova.
- Quadro (+ na seção Quadros): canvas infinito com notas (duplo clique para escrever), cards, imagens, formas e ligações livres.
- Árvore de relações ("Árvore de relações" na mesma seção): cards ligados por relações reais. Cada ligação grava uma relação no banco e aparece nas fichas dos cards.
- Organizar em árvore: dispõe os cards em níveis a partir do card selecionado.
- Remover um card de uma árvore não apaga as relações dele com os outros cards; apagar uma ligação, sim.

## Fase 7 — Fichas e tabelas
Migração automática (versão 4: tipo e vínculo com card na tabela `sheets`). Sem novas dependências.
- Ficha: atributos literários (Físico, Força, Temperamento, Intelecto, Aparência, Origem, Ofício). Escolha uma opção (magro, fraco, mediano, forte, atlético...) ou escreva com suas palavras, e anote detalhes. Opções são editáveis em "Opções".
- Tabela: inventários, preços, populações. Edição inline, colunas de texto ou número, total automático nas colunas numéricas.
- Em cada card há a seção "Fichas deste card", com botão para criar a ficha já vinculada.

## Fase 8 — Escrita (Quill)
Sem migração nova e sem dependências novas. Barra lateral → Livros → + .
- Livros com capítulos ilimitados. Subir, descer, renomear e excluir capítulos.
- Editor com negrito, itálico, títulos, listas, citações e @menções a cards.
- Painel direito: Notas (por capítulo), Mundo (ler um card ao lado), Versões (guardadas a cada 10 min e antes de cada restauração) e Rádio.
- Modo foco: esconde a barra lateral e as abas. Saia com Esc.
- Rádio: estações com faixas da biblioteca de áudio. Continua tocando ao trocar de aba.

## Fase 9 — Wiki estática
Sem migração nova e sem dependências novas. Barra lateral → Wiki.
- Publique o mundo em uma pasta: cada card vira uma página com ficha, conteúdo, relações, menções, mapas e linhas do tempo; mapas têm pins e zonas clicáveis; árvores de relações viram diagramas; a linha do tempo mostra a versão canon.
- Pasta de saída padrão: %APPDATA%\Atlas\dados\wiki\<mundo>. Você pode escolher outra. O app só apaga pastas que ele mesmo criou.
- Abrir no navegador: sobe um servidor só na sua máquina (127.0.0.1) na porta configurada (4321 por padrão).
- Desmarque cards para tirá-los do site.

## Fase 10 — Importação
Novas dependências: mammoth (Word/Google Docs) e adm-zip (zip do Notion). Rode `npm install` depois de extrair.
Barra lateral → Importar. Origens: Obsidian (pasta do cofre), Notion (Markdown & CSV, pasta ou zip), World Anvil (pasta de artigos), Google Docs e Word (.docx/.html viram livros, títulos de nível 1 viram capítulos).
A importação só adiciona. Antes de confirmar, a prévia mostra o que será criado e os avisos.

## Fase 11 — Oficina e instalador (.exe)
### Oficina
Barra lateral → Oficina. Instale extensões (.json) com modelos de card e de ficha. O arquivo `exemplos/oficina-literaria.json` vem com o Atlas para testar.
Extensões são dados: não executam código. Formato em `exemplos/oficina-literaria.json`.

### Gerar o instalador (Windows)
Dê dois cliques em **GERAR-EXE.bat** (ou rode `npm install` e `npm run build`).
O instalador sai em `dist\Atlas-Setup-0.1.0.exe`. Ele instala o Atlas como um programa comum, com atalho na área de trabalho.
Não é necessário ícone: o padrão do Electron é usado. Para colocar o seu, salve um `icon.ico` em `resources\`, e adicione `icon: resources/icon.ico` em `electron-builder.yml`, dentro de `win:`.
Os dados ficam em `%APPDATA%\Atlas\dados\` e não são apagados ao reinstalar.

## Ajuste — Barra lateral
- Removida a seção "em breve".
- Cada área é uma seção recolhível (clique no título para abrir ou fechar). O estado fica salvo.
- Os botões de ação (+, Tipos, Árvore etc.) ficam ao lado do título, sem sobrepor texto.
- Ferramentas (Biblioteca de mídia, Wiki, Oficina, Importar) ficam numa seção própria, fechada por padrão.

## Ajuste — Trilho de ícones
- Menu esquerdo com ícones: passe o mouse para ver o nome; clique para abrir o painel da área.
- Clique no mesmo ícone ou no X para fechar o painel.
- Arraste a borda direita do painel para alargar ou estreitar (a largura fica salva).
- Cada painel tem busca própria.
- Requer `npm install` (nova dependência: lucide-react, para os ícones).

## Ajustes — Ícone, tags, capa, cores e galeria
- **Ícone**: livro com caneta (resources/icon.ico e icon.png). O instalador usa o icon.ico automaticamente.
- **Tags**: crie tags pelo painel "Tags" (ícone de etiqueta) ou direto no card. Cada tag tem cor. Clique numa tag para ver os cards dela. Pontinhos coloridos aparecem na árvore de cards.
- **Capa do card**: faixa no topo do card, separada da imagem. Aparece também na galeria.
- **Cor das pastas**: clique com o botão direito (ou ⋯) numa pasta e escolha a cor.
- **Galeria**: ícone de grade nas ferramentas. Cards em cartões com capa, filtro por tipo e por tag, e busca.
- **Fichas**: o atributo "Força" virou "Coragem" nas fichas novas (opções: medroso, hesitante, firme, destemido, temerário). Fichas antigas mantêm "Força"; é só renomear o atributo nelas.
- Requer `npm install` (sem novas dependências; migração automática para o banco, versão 5).

## Correção — tela em branco ao abrir o .exe
- A interface agora é carregada pelo endereço interno atlas:// (antes era aberta direto do disco).
- Se a interface falhar, aparece uma mensagem de erro em vez de tela vazia.
- Se ainda estiver em branco: Exibir → Ferramentas de desenvolvedor → aba Console, e envie a mensagem vermelha.

## Correção — loop de atualização na árvore de cards
- O pontinho de tags na árvore de cards repetia a renderização sem fim. Corrigido.

## Novidades — menções, corretor e dicionário
- **Menção a card inexistente**: ao digitar @nome e não achar, aparece "Criar card" na lista. O card entra com o tipo Desconhecido, que você troca depois no próprio card.
- **Importação**: links para páginas que não existem (Obsidian, Notion) viram cards Desconhecido, para completar depois.
- **Corretor**: clique com o botão direito numa palavra marcada para ver sugestões ou "Adicionar ao dicionário". Funciona em todos os campos de texto.
- Na primeira vez, o Electron baixa o dicionário de português pela internet. Depois funciona offline.

## Novidades — cores, tags, abas e grafo
- **Cores de pasta**: 14 cores.
- **Tags no texto**: digite # e o nome da tag para mencioná-la. Clicar na tag abre a página dela.
- **Descrição da tag**: campo na página da tag. Salva ao sair do campo.
- **Abas com rolagem**: setas nas pontas da barra, roda do mouse, e a aba ativa é levada à vista automaticamente.
- **Grafo da home**: zoom pela roda ou pelos botões (+, −, Ver tudo). Arraste uma bolinha para puxar os cards ligados junto. Segure para destacar as conexões. Clique para abrir o card.
- Migração automática do banco (versão 6: descrição das tags).

## Fase 1 (tags) — ajuste
- Tags no texto aparecem em laranja, como as menções de card.
- Digitar # com um nome que não existe oferece "Criar a tag".

## Fase 2 — Idioma (Português / English)
- Configurações (ícone de engrenagem no menu) → Idioma. O app reinicia a tela para aplicar.
- O menu do Windows também muda de idioma.
- Traduzidos: menus, barra lateral, abas, galeria, grafo, tela de erro, configurações e os textos dos módulos (cards, mapas, linhas do tempo, quadros, mídia, escrita, fichas, importação, wiki e oficina).
- Não traduzidos: conteúdo que você escreve, nomes de arquivos e os dados de exemplo da oficina.

## Imagens no texto
- Botão **Imagem** na barra do editor: escolha uma imagem ou GIF da biblioteca e ela é inserida no cursor.
- Funciona nos cards e nos capítulos do Quill. A wiki também exibe as imagens.
- Requer `npm install` (nova dependência: @tiptap/extension-image).
- Se a imagem da biblioteca for apagada, ela deixa de aparecer no texto.

## Rádio (nova aba)
- Ícone de rádio no trilho de ícones abre a tela da Rádio.
- **Músicas da biblioteca (offline):** estações com barra de progresso, tempo, repetir e aleatório.
- **Playlist online (YouTube):** cole o link de um vídeo ou playlist do YouTube. Toca no player oficial do YouTube e precisa de internet.
- Não há download: o YouTube não permite baixar músicas por aplicativos de terceiros.
- Limitação: o YouTube Music não pode ser tocado dentro de outro app. Use playlists e vídeos do YouTube.
- Migração automática (versão 7: playlists online). Sem novas dependências.

## Eventos, linha do tempo e livro
- Card pode ser marcado como **evento** (caixa "Este card é um evento" no painel).
- Eventos ganham a seção **Envolvidos**, abaixo do texto, para marcar vários cards.
- Seção **Eventos** no trilho: lista os eventos e cria novos.
- Linha do tempo: "+ Evento" escolhe um evento já criado. Você define data, posição, era e versão.
- Livro: painel **Eventos** mostra os eventos, seus envolvidos e o texto.
- Migração v8: eventos antigos da linha do tempo viram cards de evento. Playlists do YouTube foram removidas.

## Nascimentos, fundações e fins (linha do tempo)
- Faixa no topo da linha do tempo: **Nascimento** (personagens) ou **Fundação** (lugares).
- Marque o **fim** quando algo acabar: morte, abandono, destruição ou fim.
- O tipo do card define o padrão: card do tipo Lugar, Cidade, Reino etc. começa com fundação e termina com abandono.
- A ficha do card mostra em quais linhas do tempo ele nasce ou é fundado.
- A wiki também mostra essa lista na página da linha do tempo.
- Migração v9. Sem novas dependências.

## Facções e busca de cards na faixa
- Facções também podem ter início e fim: **Fundação** e **Dissolução**. O tipo do card define o padrão (facção, lugar ou personagem).
- A lista de **+ Adicionar** tem busca por nome.

## Lista de nascimentos compacta
- Cada item da faixa ocupa duas linhas: nome e, abaixo, tipo, início, fim e motivo.
- A lista fica ordenada pela data de início.
- Com mais de seis itens aparece um campo de busca para filtrar.

## Ajustes da faixa
- Lista de nascimentos e fundações: com mais de seis itens, a lista tem altura fixa e rola com o mouse.
- Na faixa, nascimentos são verdes e fundações são laranja.

## Faixa de nascimentos mais compacta
- A faixa mostra no máximo 4 linhas e rola com o mouse quando há mais.
- Cada nome ocupa só o espaço do próprio texto, então mais itens cabem na mesma linha.

## Grupos na faixa de nascimentos
- Três ou mais itens muito próximos viram um marcador com o número (ex.: +4).
- Ao clicar, abre a lista desse grupo; clicar em um nome abre o card.

## Traçados nos mapas e estilo de texto
- **Traçado** (tecla L): clique para adicionar pontos. Ao clicar perto de um pin, o traçado se prende a ele. Conclua com Enter ou duplo clique. Use para estradas, rios e caminhos.
- Traçados têm espessura (fina, média, grossa) e podem ser tracejados.
- **Editor de texto:** escolha a fonte e o tamanho, use A+ e A−, e o botão "Estilo de região" para nomes de regiões (maiúsculas, letra espaçada, fonte serifada). Vale para cards e capítulos.
- Requer `npm install` (nova dependência: @tiptap/extension-text-style).

## Temas, galeria, propriedade de card e wiki
- **Temas:** escuro, claro e pergaminho. Escolha o tema do app em Configurações. Cada mundo pode ter o próprio tema, na home do mundo ("Padrão do app" segue o tema geral).
- **Galeria:** ordenar por nome, mais recentes, mais antigos ou tipo.
- **Propriedade "Card vinculado":** aponta para outro card. Crie em "Tipos de card" escolhendo esse tipo de campo.
- **Wiki:** envolvidos dos eventos, quadros (com as notas) e versões da linha do tempo.
- Ctrl+Z e Ctrl+Y já funcionam nos textos (desfazer e refazer do editor).

## Destaques na home e campos de várias respostas
- **Destaques:** na home do mundo, o carrossel mostra os cards escolhidos. Em "Editar destaques" marque os cards e defina a ordem com as setas.
- **Várias respostas:** novo tipo de campo "Várias respostas" (chips). Digite e aperte Enter; o × remove um valor. A wiki mostra os valores separados por vírgula.
- Migração v10 (destaques). Sem novas dependências.

## Destaques na home e campos de várias respostas
- **Destaques:** na home do mundo, o carrossel mostra os cards escolhidos. Em "Editar destaques" marque os cards e defina a ordem com as setas.
- **Várias respostas:** novo tipo de campo "Várias respostas" (chips). Digite e aperte Enter; o × remove um valor. A wiki mostra os valores separados por vírgula.
- Migração v10 (destaques). Sem novas dependências.

## Ajustes: temas, destaques, barra de texto, eventos e inventário
- Temas claro e pergaminho com texto preto. Os nomes do grafo seguem o tema.
- Tema escolhido só em Configurações (o seletor da home saiu).
- Destaques giram sozinhos a cada 5 segundos; param com o mouse em cima.
- Barra de texto numa linha só, com ícones. Passe o mouse para ver o nome.
- Eventos têm as propriedades Data, Local, Causa e Resultado.
- Ficha do personagem: seção Inventário. Os itens viram relação "possui" e aparecem nas relações e na wiki.

## Ajustes finais: tema escuro, destaques e inventário
- Tema escuro com texto branco. Claro e pergaminho continuam com texto preto.
- Destaques automáticos: sem nenhuma escolha, o app gira todos os cards do mundo em ordem aleatória, a cada 5 segundos. "Escolher destaques" é opcional.
- Inventário: você escolhe quais tipos de card são itens (por padrão, os que têm "item" no nome).
- Eventos não têm a seção de inventário.

## Itens únicos e múltiplos
- Eventos não têm mais a propriedade Data (a data fica na linha do tempo).
- Itens ganham a propriedade **Quantidade**: **Único** (um personagem por vez) ou **Muitos**.
- No inventário, um item único que já está com outro personagem aparece bloqueado, com o nome do dono. A regra também é checada ao salvar.

## Estoque de arte
- Pasta `stock-art/`, com 74 imagens separadas por gênero e subgênero, e o arquivo `index.json`.
- Na biblioteca de mídia, o botão **Estoque de arte** abre as imagens por gênero. Escolha e importe para o mundo.
- Imagens só entram na biblioteca quando você importa. Não há duplicatas: se a imagem já existir, não é copiada de novo.
- Licença: as imagens precisam de autorização de uso antes de publicar (ver LICENSE-stock quando for preparado).

## Desfazer exclusão de card
- Ctrl+Z desfaz a última exclusão de card (com ligações, tags, envolvidos, nascimentos e destaques).
- Não vale dentro de campos de texto, onde o Ctrl+Z continua sendo do texto.
