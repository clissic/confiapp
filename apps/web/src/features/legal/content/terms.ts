/** Contenido legal de Términos y Condiciones de uso de ConfiApp. */

export const TERMS_LAST_UPDATED = '30 de agosto de 2026';

export type TermsSection = {
  id: string;
  title: string;
  paragraphs: string[];
  /** Ítems tipo a), b), c)… */
  items?: string[];
  /** Viñetas adicionales (p. ej. sección 31) */
  bullets?: string[];
  /** Párrafo(s) después de la lista */
  afterItems?: string[];
};

export const TERMS_SECTIONS: TermsSection[] = [
  {
    id: '1',
    title: 'Identificación y aceptación',
    paragraphs: [
      'Los presentes Términos y Condiciones regulan el acceso y utilización de la plataforma digital ConfiApp (en adelante, la “Plataforma”), así como los servicios tecnológicos y de intermediación puestos a disposición de sus usuarios.',
      'La utilización, registro o acceso a la Plataforma implica la lectura, comprensión y aceptación expresa de estos Términos y Condiciones, así como de las políticas y documentos que eventualmente se incorporen a ellos.',
      'En caso de no estar de acuerdo con cualquiera de las disposiciones aquí establecidas, el usuario deberá abstenerse de utilizar la Plataforma.',
      'ConfiApp podrá actualizar estos Términos y Condiciones cuando resulte necesario, comunicando las modificaciones conforme a los mecanismos disponibles en la Plataforma.',
    ],
  },
  {
    id: '2',
    title: 'Naturaleza y finalidad de ConfiApp',
    paragraphs: [
      'ConfiApp es una plataforma tecnológica de intermediación y coordinación cuyo objetivo es facilitar operaciones entre personas que desean comprar, vender, entregar, verificar o recibir bienes.',
      'ConfiApp no es propietaria de los bienes ofrecidos por los usuarios, no compra ni vende los bienes, no actúa como vendedor ni comprador, y no forma parte de la compraventa celebrada entre los usuarios, salvo respecto de aquellos servicios específicos que expresamente sean contratados directamente con ConfiApp.',
      'La Plataforma constituye un mecanismo tecnológico destinado a facilitar la comunicación, coordinación, verificación y, cuando corresponda, gestión de determinadas etapas de una operación entre usuarios y agentes independientes.',
      'La utilización de ConfiApp no convierte a la Plataforma en parte de la relación comercial, contractual o jurídica existente entre comprador, vendedor y/o agente, salvo que expresamente se indique lo contrario.',
    ],
  },
  {
    id: '3',
    title: 'Relación entre comprador y vendedor',
    paragraphs: [
      'Toda compraventa de bienes que se origine a través de ConfiApp será celebrada directamente entre el comprador y el vendedor.',
      'ConfiApp no garantiza que el vendedor sea propietario del bien, que tenga facultades suficientes para disponer del mismo, ni que el bien se encuentre libre de gravámenes, reclamos, embargos, derechos de terceros o cualquier otra circunstancia jurídica que pudiera afectarlo, salvo que expresamente se haya contratado un servicio específico de verificación sobre tales extremos.',
      'El vendedor será exclusivamente responsable por:',
    ],
    items: [
      'La existencia y legitimidad del bien;',
      'La titularidad o facultad legal para venderlo;',
      'La exactitud de la información proporcionada;',
      'El estado, características, funcionamiento y condiciones del bien;',
      'La autenticidad del bien y de su documentación;',
      'La ausencia de falsificaciones, adulteraciones o bienes de procedencia ilícita;',
      'El cumplimiento de las obligaciones legales, tributarias y comerciales que correspondan;',
      'Los daños que pudiera ocasionar el bien cuando legalmente corresponda.',
    ],
    afterItems: [
      'El comprador será responsable de evaluar la información disponible y de efectuar las verificaciones que considere necesarias antes de concretar la operación.',
    ],
  },
  {
    id: '4',
    title: 'ConfiApp no es un marketplace tradicional',
    paragraphs: [
      'ConfiApp no constituye necesariamente un mercado electrónico en el que la Plataforma compre, venda, almacene, posea o distribuya los bienes ofrecidos por los usuarios.',
      'La publicación de información sobre un bien, usuario o servicio dentro de la Plataforma no implica que ConfiApp garantice, certifique, recomiende o respalde la operación, salvo cuando se indique expresamente que se trata de un servicio de verificación o garantía específicamente contratado.',
    ],
  },
  {
    id: '5',
    title: 'Agentes independientes',
    paragraphs: [
      'Cuando una operación requiera la participación de un agente, éste actuará como prestador independiente, por cuenta y riesgo propio.',
      'El agente podrá aceptar o rechazar solicitudes de manera libre y voluntaria, sujeto a las condiciones de funcionamiento de la Plataforma.',
      'La utilización de la Plataforma no genera por sí misma una relación laboral, de dependencia, representación, agencia, sociedad, asociación, mandato general, franquicia o vínculo de subordinación entre ConfiApp y el agente.',
      'El agente será responsable de organizar y ejecutar autónomamente su actividad, utilizando sus propios medios, herramientas, vehículos, equipos y recursos, cuando corresponda.',
      'El agente será responsable de cumplir con todas las obligaciones legales, fiscales, previsionales, de seguridad, circulación, habilitación y demás requisitos que resulten aplicables a su actividad.',
      'Nada de lo establecido en estos Términos pretende impedir la aplicación de normas imperativas que eventualmente resulten aplicables a una relación determinada.',
    ],
  },
  {
    id: '6',
    title: 'Ausencia de exclusividad',
    paragraphs: [
      'Los agentes podrán prestar servicios para terceros y utilizar otras plataformas, aplicaciones o medios de trabajo, siempre que ello no implique incumplir obligaciones legales o contractuales válidamente asumidas.',
      'ConfiApp no garantiza al agente una cantidad mínima de solicitudes, ingresos, operaciones o servicios.',
      'La disponibilidad de oportunidades dentro de la Plataforma dependerá de la demanda, ubicación, horarios, características de las operaciones y demás factores aplicables.',
    ],
  },
  {
    id: '7',
    title: 'Responsabilidad del agente durante la entrega',
    paragraphs: [
      'Cuando un agente acepte realizar una entrega, retiro, traslado, verificación física u otra actividad relacionada con un bien, será responsable de ejecutar la tarea de conformidad con las instrucciones recibidas y con la normativa aplicable.',
      'Desde el momento en que el agente recibe físicamente un bien hasta su entrega, devolución o finalización de la gestión, deberá adoptar las medidas de cuidado, conservación y manipulación necesarias según la naturaleza de la tarea y del bien.',
      'El agente será responsable de los daños, pérdidas, sustracciones, apropiaciones, deterioros o incumplimientos que le sean legalmente imputables.',
      'ConfiApp no responderá automáticamente por los actos u omisiones del agente por el solo hecho de haber facilitado su contacto o coordinación mediante la Plataforma, sin perjuicio de las responsabilidades que legalmente pudieran corresponder a ConfiApp por sus propios actos, incumplimientos o servicios directamente prestados.',
    ],
  },
  {
    id: '8',
    title: 'Robo, hurto, pérdida, extravío o apropiación indebida',
    paragraphs: [
      'ConfiApp no garantiza la custodia material de los bienes trasladados por agentes independientes.',
      'Cuando un bien se encuentre físicamente bajo la custodia de un agente, cualquier pérdida, hurto, robo, apropiación indebida, destrucción, deterioro o desaparición será analizada conforme a las circunstancias verificables de cada operación y a la responsabilidad que legalmente corresponda al agente, al usuario o a cualquier tercero involucrado.',
      'ConfiApp podrá colaborar con los usuarios y con las autoridades competentes proporcionando la información disponible en sus sistemas, dentro de los límites establecidos por la legislación aplicable y sus políticas de privacidad.',
      'La utilización de ConfiApp no constituye por sí misma un seguro sobre los bienes.',
    ],
  },
  {
    id: '9',
    title: 'Daños producidos durante el traslado',
    paragraphs: [
      'ConfiApp no será responsable por daños ocasionados a los bienes durante el traslado cuando éste sea ejecutado materialmente por un agente independiente, salvo que exista responsabilidad legalmente imputable a ConfiApp.',
      'El agente deberá adoptar las medidas de cuidado, transporte, manipulación y conservación necesarias según las características del bien y las instrucciones registradas en la operación.',
      'El usuario deberá informar previamente cualquier característica especial del objeto que pueda requerir condiciones particulares de traslado, incluyendo fragilidad, dimensiones, peso, temperatura, riesgos especiales o instrucciones de manipulación.',
    ],
  },
  {
    id: '10',
    title: 'Objetos prohibidos',
    paragraphs: [
      'Queda prohibido utilizar ConfiApp para coordinar el traslado, entrega, custodia o comercialización de bienes cuya circulación, posesión o comercialización sea ilegal o se encuentre restringida por la normativa aplicable.',
      'Entre otros, podrán ser rechazados bienes:',
    ],
    items: [
      'De procedencia ilícita;',
      'Falsificados o adulterados;',
      'Robados;',
      'Cuya comercialización se encuentre legalmente prohibida;',
      'Que puedan generar un riesgo para personas, bienes o terceros;',
      'Que requieran habilitaciones, permisos o condiciones especiales que no se encuentren acreditadas.',
    ],
    afterItems: [
      'ConfiApp podrá cancelar, suspender o rechazar una operación cuando existan elementos objetivos que indiquen incumplimiento, fraude, actividad ilícita o riesgo para los usuarios, agentes o terceros.',
    ],
  },
  {
    id: '11',
    title: 'Verificación de identidad',
    paragraphs: [
      'ConfiApp podrá solicitar información y documentación destinada a verificar la identidad de compradores, vendedores y agentes.',
      'La verificación de identidad no implica que ConfiApp garantice la solvencia, honestidad, antecedentes, capacidad patrimonial, titularidad de bienes o comportamiento futuro de la persona verificada.',
      'Una identidad verificada significa únicamente que determinados datos fueron contrastados mediante los mecanismos disponibles para ConfiApp.',
    ],
  },
  {
    id: '12',
    title: 'Verificación de bienes',
    paragraphs: [
      'Cuando ConfiApp ofrezca servicios de verificación, éstos estarán limitados a las verificaciones expresamente indicadas en la descripción del servicio contratado.',
      'Una verificación no implica una garantía absoluta sobre el bien ni sustituye las comprobaciones legales, técnicas, comerciales o profesionales que correspondan.',
      'Cuando la naturaleza del bien lo requiera, el comprador deberá recurrir a profesionales, organismos, registros o técnicos especializados.',
    ],
  },
  {
    id: '13',
    title: 'Operaciones fraudulentas',
    paragraphs: [
      'ConfiApp podrá implementar mecanismos tecnológicos y operativos destinados a detectar operaciones sospechosas, fraudulentas o potencialmente ilícitas.',
      'Sin embargo, ningún sistema de prevención puede garantizar la detección de la totalidad de los intentos de fraude.',
      'ConfiApp no garantiza que ningún usuario pueda intentar cometer fraude, falsificar información, utilizar documentación falsa, apropiarse indebidamente de bienes o incumplir sus obligaciones.',
      'Cuando existan elementos que indiquen una conducta ilícita, ConfiApp podrá suspender la operación y colaborar con las autoridades competentes conforme a la legislación aplicable.',
    ],
  },
  {
    id: '14',
    title: 'Limitación de responsabilidad de ConfiApp',
    paragraphs: [
      'En la máxima medida permitida por la legislación aplicable, ConfiApp no será responsable por daños, pérdidas, perjuicios, incumplimientos o reclamos que tengan como causa directa:',
    ],
    items: [
      'Actos u omisiones de compradores, vendedores, agentes o terceros;',
      'Información falsa, incompleta o incorrecta proporcionada por los usuarios;',
      'Incumplimientos de contratos celebrados entre usuarios;',
      'Daños, pérdidas o deterioros ocasionados durante una actividad material ejecutada por terceros;',
      'Fraudes o conductas delictivas cometidas por terceros;',
      'Fallas de servicios de terceros utilizados por los usuarios;',
      'Casos fortuitos o de fuerza mayor;',
      'Imposibilidad de prestar un servicio por causas ajenas a ConfiApp;',
      'Uso indebido de la Plataforma;',
      'Bienes defectuosos, peligrosos, falsificados o de procedencia ilícita;',
      'Información o documentación falsa suministrada por los usuarios.',
    ],
    afterItems: [
      'Esta limitación no tendrá por objeto excluir responsabilidades que legalmente no puedan ser excluidas o limitadas.',
    ],
  },
  {
    id: '15',
    title: 'Alcance de los servicios tecnológicos',
    paragraphs: [
      'ConfiApp procurará mantener la Plataforma disponible y funcionando correctamente, pero no garantiza que el servicio sea permanente, ininterrumpido o libre de errores.',
      'Podrán producirse interrupciones por mantenimiento, actualizaciones, fallas técnicas, problemas de conectividad, servicios de terceros, ataques informáticos, acontecimientos imprevisibles o causas externas a ConfiApp.',
      'La Plataforma se proporciona sobre la base de disponibilidad tecnológica y no constituye una garantía de que una operación determinada será completada exitosamente.',
    ],
  },
  {
    id: '16',
    title: 'Pagos y fondos',
    paragraphs: [
      'Cuando ConfiApp facilite mecanismos tecnológicos relacionados con pagos, éstos serán utilizados conforme a las condiciones particulares informadas para cada servicio.',
      'La utilización de un medio de pago o mecanismo tecnológico de procesamiento no convierte a ConfiApp en parte de la compraventa subyacente.',
      'Cuando intervengan procesadores de pago, instituciones financieras u otros terceros, éstos podrán encontrarse sujetos a sus propios términos, condiciones y políticas.',
      'ConfiApp no será responsable por demoras, rechazos, bloqueos o fallas atribuibles a dichos terceros, salvo responsabilidad legalmente imputable a ConfiApp.',
      'En operaciones con confirmación dual de entrega (comprador y agente), la liberación de fondos retenidos se producirá cuando ambas confirmaciones queden registradas o cuando opere la confirmación automática prevista en estos Términos.',
      'Desde que una de las partes confirma la entrega o el arribo, el comprador dispone de un plazo de setenta y dos (72) horas para confirmar el arribo del producto o reportar a través de la Plataforma que no lo recibió. Vencido dicho plazo sin acción del comprador, ConfiApp podrá registrar automáticamente la recepción y proceder con la liberación de fondos conforme a las reglas de la operación.',
      'El comprador reconoce que la confirmación automática produce los mismos efectos operativos que una confirmación manual de arribo, sin perjuicio de los reclamos o disputas que pudieran formularse conforme a estos Términos dentro de los plazos aplicables.',
    ],
  },
  {
    id: '17',
    title: 'Suspensión y cancelación de cuentas',
    paragraphs: [
      'ConfiApp podrá suspender, limitar o cancelar una cuenta cuando existan elementos objetivos que indiquen:',
    ],
    items: [
      'Fraude;',
      'Robo o apropiación indebida;',
      'Uso de documentación falsa;',
      'Incumplimiento de estos Términos;',
      'Actividades ilícitas;',
      'Amenazas o violencia;',
      'Conductas que pongan en riesgo a otros usuarios, agentes o terceros;',
      'Manipulación de los sistemas de la Plataforma;',
      'Uso indebido de información personal;',
      'Incumplimientos reiterados.',
    ],
    afterItems: [
      'Cuando corresponda, ConfiApp podrá solicitar información adicional antes de adoptar una decisión definitiva.',
    ],
  },
  {
    id: '18',
    title: 'Conducta de los usuarios y agentes',
    paragraphs: [
      'Todos los participantes deberán mantener una conducta respetuosa y abstenerse de realizar amenazas, violencia física o verbal, acoso, intimidación, discriminación, extorsión o cualquier otra conducta ilícita.',
      'La Plataforma podrá suspender inmediatamente la utilización de una cuenta cuando existan hechos verificables que indiquen un riesgo para la integridad de una persona o para la seguridad de una operación.',
    ],
  },
  {
    id: '19',
    title: 'Indemnidad',
    paragraphs: [
      'En la medida permitida por la legislación aplicable, el usuario y/o agente se compromete a mantener indemne a ConfiApp, sus administradores, representantes, colaboradores y proveedores frente a reclamos, daños, sanciones, costos y gastos que sean consecuencia de:',
    ],
    items: [
      'El incumplimiento de estos Términos;',
      'La utilización ilícita o fraudulenta de la Plataforma;',
      'Información falsa proporcionada por el usuario;',
      'La violación de derechos de terceros;',
      'La comercialización, entrega o traslado de bienes ilícitos;',
      'Actos u omisiones imputables exclusivamente al usuario o agente.',
    ],
    afterItems: [
      'Esta obligación no será aplicable cuando la responsabilidad corresponda legalmente a ConfiApp.',
    ],
  },
  {
    id: '20',
    title: 'Relación contractual independiente',
    paragraphs: [
      'El uso de la Plataforma por parte de un agente independiente no implica, por sí solo, la existencia de una relación laboral con ConfiApp.',
      'El agente conserva autonomía para organizar su actividad, aceptar o rechazar solicitudes cuando ello sea posible, determinar su disponibilidad y utilizar otros medios o plataformas.',
      'El agente será responsable de sus obligaciones fiscales, previsionales, laborales, de seguridad social, habilitaciones y demás obligaciones que correspondan conforme a la legislación vigente.',
      'Las partes reconocen que ninguna disposición de estos Términos pretende excluir derechos laborales o protecciones que resulten indisponibles conforme a normas imperativas.',
    ],
  },
  {
    id: '21',
    title: 'Ausencia de representación',
    paragraphs: [
      'Ningún usuario o agente está autorizado para representar a ConfiApp, asumir obligaciones en su nombre, celebrar contratos en nombre de ConfiApp o manifestar que actúa como empleado, representante, mandatario o dependiente de la empresa, salvo autorización expresa.',
    ],
  },
  {
    id: '22',
    title: 'Datos personales',
    paragraphs: [
      'ConfiApp podrá recopilar, almacenar y procesar los datos necesarios para proporcionar sus servicios, verificar identidades, prevenir fraudes, gestionar operaciones y cumplir obligaciones legales.',
      'El tratamiento de datos personales se realizará conforme a la normativa uruguaya aplicable y a la Política de Privacidad de ConfiApp.',
      'Los usuarios deberán utilizar los datos de terceros exclusivamente para los fines relacionados con la operación y abstenerse de utilizarlos para fines comerciales, ilícitos o ajenos a la relación generada mediante la Plataforma.',
    ],
  },
  {
    id: '23',
    title: 'Evidencia de las operaciones',
    paragraphs: [
      'ConfiApp podrá conservar registros electrónicos relacionados con las operaciones realizadas mediante la Plataforma, incluyendo información de usuarios, comunicaciones, estados de operaciones, fechas, horarios, ubicaciones cuando corresponda, comprobantes, fotografías y demás información generada por el sistema.',
      'Dichos registros podrán utilizarse para investigar reclamos, prevenir fraudes, resolver controversias y colaborar con autoridades competentes cuando legalmente corresponda.',
    ],
  },
  {
    id: '24',
    title: 'Reclamos',
    paragraphs: [
      'Los usuarios deberán comunicar cualquier inconveniente relacionado con una operación a través de los canales habilitados por ConfiApp dentro de las veinticuatro (24) horas siguientes a la entrega, recepción, cancelación o finalización de la operación, según corresponda.',
      'Si el agente declaró la entrega y el comprador no recibió el producto, el comprador deberá reportarlo mediante la función de disputa de la Plataforma antes de que venza el plazo de setenta y dos (72) horas contado desde la primera confirmación de entrega o arribo, conforme a la sección de Pagos y fondos.',
      'La recepción de un reclamo no implica reconocimiento de responsabilidad por parte de ConfiApp.',
      'ConfiApp podrá solicitar documentación, fotografías, comprobantes, conversaciones y cualquier otra evidencia necesaria para analizar el caso.',
    ],
  },
  {
    id: '25',
    title: 'Cooperación ante delitos',
    paragraphs: [
      'Ante denuncias de robo, estafa, apropiación indebida, violencia, amenazas, falsificación u otros hechos potencialmente delictivos, ConfiApp podrá colaborar con las autoridades competentes proporcionando la información que legalmente corresponda.',
      'La Plataforma no sustituye la denuncia ante la Policía, Fiscalía, Poder Judicial u organismo competente.',
      'Los usuarios deberán realizar la correspondiente denuncia ante las autoridades cuando sean víctimas o tengan conocimiento de un hecho que pudiera constituir un delito.',
    ],
  },
  {
    id: '26',
    title: 'Propiedad intelectual',
    paragraphs: [
      'La Plataforma, su software, diseño, interfaces, marcas, logotipos, contenidos, bases de datos y demás elementos que la integran son propiedad de ConfiApp o de sus respectivos titulares.',
      'Ningún usuario adquiere derechos de propiedad intelectual sobre dichos elementos por el simple hecho de utilizar la Plataforma.',
    ],
  },
  {
    id: '27',
    title: 'Prohibición de uso indebido',
    paragraphs: ['Queda prohibido:'],
    items: [
      'Manipular la Plataforma;',
      'Intentar acceder a cuentas de terceros;',
      'Utilizar sistemas automatizados no autorizados;',
      'Extraer información masivamente;',
      'Interferir con el funcionamiento de la Plataforma;',
      'Crear cuentas falsas;',
      'Utilizar identidades de terceros;',
      'Utilizar la Plataforma para actividades ilícitas;',
      'Intentar eludir mecanismos de seguridad;',
      'Utilizar la Plataforma para perjudicar a otros usuarios.',
    ],
  },
  {
    id: '28',
    title: 'Fuerza mayor',
    paragraphs: [
      'ConfiApp no será responsable por incumplimientos derivados de acontecimientos que se encuentren fuera de su control, incluyendo, entre otros, fallas generalizadas de telecomunicaciones, interrupciones de servicios tecnológicos, catástrofes naturales, conflictos, actos de autoridad, disturbios, epidemias, ataques informáticos u otros acontecimientos imprevisibles o inevitables.',
    ],
  },
  {
    id: '29',
    title: 'Nulidad parcial',
    paragraphs: [
      'Si alguna disposición de estos Términos fuese declarada inválida, ilegal o inaplicable, ello no afectará la validez de las restantes disposiciones.',
      'La disposición afectada deberá interpretarse, en la medida legalmente posible, de forma compatible con la finalidad económica y jurídica originalmente perseguida.',
    ],
  },
  {
    id: '30',
    title: 'Legislación aplicable',
    paragraphs: [
      'Estos Términos se regirán por las leyes de la República Oriental del Uruguay, sin perjuicio de los derechos que correspondan a los consumidores y demás personas conforme a las normas imperativas aplicables.',
      'Nada de lo establecido en estos Términos podrá interpretarse como una renuncia anticipada a derechos que legalmente resulten irrenunciables.',
    ],
  },
  {
    id: '31',
    title: 'Aceptación',
    paragraphs: [
      'Al registrarse, acceder o utilizar ConfiApp, el usuario declara haber leído, comprendido y aceptado estos Términos y Condiciones.',
      'El usuario reconoce especialmente que:',
    ],
    bullets: [
      'ConfiApp es una plataforma tecnológica de intermediación;',
      'ConfiApp no es propietaria de los bienes;',
      'ConfiApp no es parte de las compraventas entre usuarios;',
      'Los agentes actúan de forma independiente, en los términos permitidos por la legislación aplicable;',
      'El agente es responsable de la actividad material que realiza;',
      'La utilización de ConfiApp no constituye un seguro sobre los bienes;',
      'Las operaciones entre usuarios pueden implicar riesgos;',
      'Cada participante debe cumplir las obligaciones legales que le correspondan.',
    ],
    afterItems: [
      'Al seleccionar “Acepto”, el usuario manifiesta su aceptación expresa de los presentes Términos y Condiciones.',
    ],
  },
];
