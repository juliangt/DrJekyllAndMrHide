PROMPT INICIAL PARA EL DESARROLLO DEL JUEGO
Rol y Objetivo: Actúa como un desarrollador de videojuegos web Senior y experto en educación interactiva. Tu tarea es programar una aplicación web 100% client-side (HTML5, CSS3 moderno con diseño responsive/mobile-friendly, y JavaScript vainilla) que funcione como un juego educativo basado en la novela clásica El extraño caso del Dr. Jekyll y Mr. Hyde de Robert Louis Stevenson. El objetivo pedagógico es evaluar si el usuario leyó la obra a través de niveles que alternan una mecánica de acción arcade rápida (tapar/pisar) y un cuestionario de opción múltiple basado en el libro.

1. ESPECIFICACIONES TÉCNICAS GENERALES
Arquitectura: Single Page Application (SPA) modular en un solo archivo o estructura limpia (HTML, CSS integrado o enlazado, JS estructurado con clases/componentes).
Compatibilidad: Diseñado con un enfoque Mobile-First, optimizado tanto para pantallas táctiles (tap) como para computadoras de escritorio (clic).
Estética Visual (Look & Feel): Estilo gótico victoriano, lúgubre, con tonos oscuros (grises, sepias, verdes oscuros, tintes de laboratorio) y tipografías estilo máquina de escribir o góticas legibles. Animaciones fluidas mediante CSS/Canvas.
Persistencia: Uso opcional de localStorage para guardar el progreso del nivel actual y evitar perder avances si se recarga la página.
Audio: Efectos de sonido opcionales mediante Web Audio API sintetizados o mediante URLs de efectos libres de licencia para toques, pociones y errores.
2. DIAGRAMA DE FLUJO DEL JUEGO (ESTADOS)
Pantalla de Inicio (Splash Screen): Título gótico, introducción a la historia del Dr. Jekyll, botón de "Comenzar el Viaje" y selector de nivel/instrucciones.
Fase Narrativa (Lore / Transición): Breve viñeta de texto o cómic digital con ilustraciones o paneles evocadores que sitúan al jugador en el contexto del nivel.
Fase de Acción (Gameplay Arcade):
El usuario controla/actúa con el personaje correspondiente al nivel.
Minijuego de persecución/interacción (ej. tocar/pisar al objetivo N veces en un tiempo límite o sin límite).
Contador visible en pantalla de objetivos alcanzados (ej: "Víctimas alcanzadas: 2/3").
Fase de Evaluación (Quiz Literario):
Al cumplir la meta de acción, se pausa el juego y se despliega un modal o pantalla con una pregunta de opción múltiple basada estrictamente en la trama del libro.
Si la respuesta es incorrecta: Muestra retroalimentación pedagógica y permite reintentar la pregunta.
Si la respuesta es correcta: Otorga puntos, muestra un fragmento de la historia y avanza al siguiente nivel o pantalla de victoria.
Pantalla de Victoria / Final: Al completar todos los niveles, muestra un resumen del puntaje y un diploma o mensaje de felicitación por haber leído la obra.
3. DISEÑO DE NIVELES (LORE & MECÁNICAS)
Nivel 1: La Transición y el Primer Escándalo
Lore / Contexto: El Dr. Henry Jekyll experimenta en su laboratorio con polvos misteriosos hasta dar con la fórmula que libera su lado oscuro: Mr. Hyde. Una noche, Hyde atropella y pisotea sin remordimientos a una niña en las calles oscuras de Londres.
Mecánica de Acción:
El jugador controla a Mr. Hyde (o toca directamente sobre el personaje de la niña que corre erráticamente por un callejón londinense en perspectiva 2D).
Meta: Hacer tap / clic sobre la niña 3 veces para simular el atropello/incidente.
Cuestionario Post-Acción:
Pregunta: ¿Cómo logra Mr. Hyde evitar ir preso tras el incidente con la niña?
Opciones:
A) Se escapa en un carruaje secreto hacia Francia.
B) Le da un cheque (firmado por el respetable Dr. Jekyll) al padre y a la familia de la niña para calmar el escándalo. (Correcta)
C) Soborna al inspector Newcomen con una gema preciosa.
D) La policía lo confunde con un mendigo y lo deja ir.
Retroalimentación si acierta: "¡Correcto! Hyde entrega un cheque por 100 libras firmado por el estimado Dr. Jekyll, revelando la extraña conexión financiera entre ambos."
Nivel 2 (Sugerido para extender el juego): El Asaltante de la Niebla (Sir Danvers Carew)
Lore / Contexto: Pasan los meses y la brutalidad de Hyde va en aumento. Una noche de niebla, un respetable miembro del parlamento, Sir Danvers Carew, es brutalmente asesinado a palos por Hyde en un acceso de furia.
Mecánica de Acción:
Mr. Hyde persigue a Sir Danvers Carew por las calles brumosas.
El usuario debe hacer tap 5 veces sobre Carew para recrear la agresión antes de que este cruce la pantalla y escape a la niebla.
Cuestionario Post-Acción:
Pregunta: ¿Qué objeto clave se encuentra en la escena del crimen que vincula directamente a Hyde con el asesinato de Sir Danvers Carew?
Opciones:
A) Un sombrero de copa con las iniciales H.J.
B) Un bastón pesado de madera rota que Jekyll le había regalado a Utterson. (Correcta)
C) Una carta de amor escrita con la letra de Jekyll.
D) Un frasco con restos de la poción prohibida.
Retroalimentación si acierta: "¡Exacto! El bastón pesado se había roto en dos, y una mitad quedó en la escena mientras la otra se halló en el gabinete de Hyde."
Nivel 3 (Sugerido): El Secreto del Gabinete y la Carta Final
Lore / Contexto: El abogado Gabriel Utterson y el Dr. Lanyon descubren la verdad sobre los accesos de Jekyll y la doble vida. Lanyon muere tras presenciar la horrorosa transformación, y Jekyll se encierra en su laboratorio.
Mecánica de Acción:
El jugador debe recolectar los frascos de la poción que caen de la mesa del laboratorio antes de que se agote el tiempo (hacer tap en 5 frascos de sales púrpuras).
Cuestionario Post-Acción:
Pregunta: ¿Cómo se revelan finalmente todos los hechos de la historia al lector y al abogado Utterson tras la tragedia?
Opciones:
A) Utterson rompe la puerta del laboratorio y interroga a Jekyll vivo.
B) Mr. Hyde confiesa todo en un juicio público en Old Bailey.
C) Mediante una carta póstuma escrita por el Dr. Lanyon en un sobre cerrado, y la confesión final escrita por el propio Jekyll dejada en su escritorio. (Correcta)
D) La criada Poole descubre un diario secreto escondido bajo la cama.
Retroalimentación si acierta: "¡Correcto! Las cartas selladas encontradas tras el trágico desenlace explican detalladamente el tormento científico y psicológico de Jekyll y Hyde."
4. REQUISITOS TÉCNICOS DE CÓDIGO (Para entregarle al generador de código)
Estructura de Archivos Recomendada (en un solo bloque HTML o separado):
Estilos CSS limpios con animaciones CSS (@keyframes) para el parpadeo de la niebla, botones góticos con efectos hover y modales responsivos.
Lógica en JavaScript puro con una clase principal JekyllGame que maneje:
state: 'MENU', 'NARRATIVE', 'ACTION', 'QUIZ', 'VICTORY', 'GAME_OVER'.
currentLevel: Número de nivel actual.
score: Puntuación acumulada.
Funciones de renderizado dinámico del DOM según el estado actual.
