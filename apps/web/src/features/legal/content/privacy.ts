/** Contenido legal de la Política de Privacidad de ConfiApp (Uruguay). */

export const PRIVACY_LAST_UPDATED = '25 de noviembre de 2026';

export type PrivacySection = {
  id: string;
  title: string;
  paragraphs: string[];
  items?: string[];
  bullets?: string[];
  afterItems?: string[];
};

/**
 * Política alineada a la Ley N° 18.331 (Protección de Datos Personales y Acción de Habeas Data),
 * al art. 13 (deber de información) y a prácticas de plataformas uruguayas / regionales
 * (Mercado Pago, PedidosYa, Cabify) adaptadas al modelo de intermediación de ConfiApp.
 */
export const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    id: '1',
    title: 'Objeto y alcance',
    paragraphs: [
      'La presente Política de Privacidad (la “Política”) describe cómo ConfiApp (la “Plataforma”) recopila, utiliza, almacena, comparte y protege datos personales de usuarios, agentes, visitantes y demás titulares que interactúan con el sitio web, aplicaciones y servicios asociados.',
      'Al registrarte, acceder o utilizar la Plataforma, declarás haber leído esta Política y, cuando corresponda, prestás tu consentimiento libre, previo, expreso e informado para el tratamiento de tus datos personales conforme a la normativa uruguaya vigente, en particular la Ley N° 18.331 de Protección de Datos Personales y Acción de Habeas Data, sus modificativas y reglamentaciones (incluyendo el Decreto N° 414/009 y normas concordantes), bajo control de la Unidad Reguladora y de Control de Datos Personales (URCDP).',
      'Esta Política se complementa con los Términos y Condiciones de uso. Si no estás de acuerdo, no debés utilizar la Plataforma ni crear una cuenta.',
      'Si la Plataforma contiene enlaces a sitios de terceros, esta Política no aplica a esos sitios; el tratamiento allí se rige por las políticas de esos terceros.',
    ],
  },
  {
    id: '2',
    title: 'Responsable del tratamiento y base de datos',
    paragraphs: [
      'El responsable del tratamiento de los datos personales es el operador de la Plataforma ConfiApp en la República Oriental del Uruguay, quien determina las finalidades y los medios del tratamiento.',
      'Existe una base de datos de carácter personal, de soporte electrónico, asociada a la operación de la Plataforma (usuarios, agentes, operaciones, comunicaciones y registros necesarios para el servicio). Dicha base de datos se encuentra registrada ante la Unidad Reguladora y de Control de Datos Personales (URCDP).',
      'Identificación del responsable del tratamiento (a efectos del art. 13 de la Ley N° 18.331):',
    ],
    bullets: [
      'Razón social / titular: [pendiente de publicación].',
      'RUT: [pendiente de publicación].',
      'Domicilio constituido: [pendiente de publicación].',
    ],
    afterItems: [
      'Los datos de identificación del responsable se completarán y actualizarán en esta Política tan pronto como estén disponibles y, en su caso, constarán también en la inscripción ante la URCDP.',
      'El Delegado de Protección de Datos designado por ConfiApp es el Departamento Técnico de la empresa, representado por el Sr. Joaquín PÉREZ CORIA. Podés contactarlo, junto con el resto de canales de privacidad, escribiendo a privacidad@confiapp.app o utilizando los canales de soporte indicados en la Plataforma. Procuraremos responder en un plazo máximo de cinco (5) días hábiles, conforme a la normativa aplicable.',
    ],
  },
  {
    id: '3',
    title: 'Principios que aplicamos',
    paragraphs: [
      'En el tratamiento de datos personales ConfiApp procura observar, entre otros, los principios de legalidad, veracidad, finalidad, previo consentimiento informado (salvo excepciones legales), seguridad, reserva y responsabilidad proactiva previstos en la normativa uruguaya.',
      'Solo tratamos datos adecuados, pertinentes y no excesivos en relación con las finalidades informadas. No vendemos bases de datos de usuarios.',
    ],
  },
  {
    id: '4',
    title: 'Qué datos recopilamos',
    paragraphs: [
      'Los datos pueden provenir de vos (registro, perfil, operaciones), generarse por el uso de la Plataforma, o recibirse de terceros autorizados (por ejemplo, procesadores de pago o proveedores de verificación de identidad), siempre dentro de la finalidad del servicio.',
      'Según el rol y las funciones que uses, podemos tratar las siguientes categorías:',
    ],
    bullets: [
      'Identificación y cuenta: nombre completo, documento de identidad, correo electrónico, teléfono, contraseña (almacenada de forma cifrada/hash), foto de perfil, biografía y datos de verificación de email/teléfono.',
      'Domicilio y ubicación: dirección, barrio, localidad, coordenadas o puntos de encuentro que indiques para retiros/entregas; áreas de trabajo y geolocalización cuando un Agente o usuario las habilite para open jobs o coordinación.',
      'Operaciones e intermediación: títulos y descripciones de productos, precios acordados, checklist e instrucciones, estados de la operación, historial, disputas, evidencias (incluidas fotografías u otros archivos que subas) y mensajes del chat vinculados a la operación.',
      'Pagos y finanzas en la Plataforma: datos de la contratación del Agente, preferencias y eventos de Mercado Pago u otros procesadores, holds/comisiones, movimientos de wallet, métodos de cobro (p. ej. alias o datos bancarios que vos cargues para liquidaciones) y auditoría financiera asociada.',
      'Agentes y verificación reforzada: datos de onboarding de agencia, aceptación de términos de agente, horarios, estado de la agencia, vinculación OAuth con Mercado Pago y, cuando esté habilitado, datos de Identidad Digital / KYC o proveedores equivalentes.',
      'Reputación: reseñas, puntuaciones y estadísticas agregadas asociadas a tu participación.',
      'Preferencias y comunicaciones: preferencias de moneda y de notificaciones (email, push, SMS cuando existan), contenido de notificaciones in-app y registros de contacto con soporte.',
      'Datos técnicos y de seguridad: dirección IP, tipo de dispositivo/navegador, identificadores de sesión, registros de acceso, tokens de autenticación, señales anti-abuso (p. ej. Turnstile) y datos de diagnóstico o error (p. ej. herramientas de observabilidad) en la medida necesaria para operar y proteger la Plataforma.',
      'Cookies y almacenamiento local: tokens de sesión y preferencias técnicas necesarias para el funcionamiento; el detalle de cookies no esenciales, si se incorporan, se informará y gestionará conforme a esta Política.',
    ],
    afterItems: [
      'Algunos campos son obligatorios para prestar el servicio (por ejemplo, email y contraseña para crear cuenta, o datos de la operación para coordinar al Agente). Si no los proporcionás, no podremos completar el registro o la función solicitada. Otros datos son facultativos y mejoran la experiencia.',
      'Si nos facilitás datos de terceros (p. ej. contraparte o datos de contacto en una operación), declarás contar con legitimación o consentimiento para hacerlo y sos responsable frente a esos titulares.',
    ],
  },
  {
    id: '5',
    title: 'Para qué usamos los datos (finalidades)',
    paragraphs: [
      'Tratamos tus datos personales para finalidades legítimas vinculadas a la Plataforma, entre ellas:',
    ],
    bullets: [
      'Crear y administrar tu cuenta, autenticarte y mantener la seguridad del acceso.',
      'Prestar el servicio de intermediación: crear y gestionar operaciones, asignar o buscar Agentes, checklist, verificación, entrega, chat y disputas.',
      'Procesar la contratación del Agente, webhooks/sincronización de pagos, acreditación de comisiones, wallet y liquidaciones administrativas.',
      'Verificar identidad y prevenir fraude, abuso, lavado de activos u otras actividades ilícitas, incluyendo colaboración con autoridades cuando la ley lo exija.',
      'Calcular y mostrar reputación, reseñas y estadísticas de uso.',
      'Enviar notificaciones operativas (estados de operación, seguridad, pagos) y, si lo habilitás, comunicaciones comerciales o de producto.',
      'Mejorar la Plataforma, analizar uso de forma agregada o seudonimizada, soporte técnico y cumplimiento de obligaciones legales, contables y fiscales.',
      'Ejercer o defender derechos de ConfiApp, usuarios o terceros en reclamos, mediaciones o procesos judiciales/administrativos.',
    ],
  },
  {
    id: '6',
    title: 'Base del tratamiento y carácter del consentimiento',
    paragraphs: [
      'El tratamiento se basa, según el caso, en: (a) tu consentimiento al registrarte y aceptar esta Política junto con los Términos y Condiciones; (b) la ejecución de la relación contractual o precontractual para prestar el servicio solicitado; (c) el cumplimiento de obligaciones legales; y/o (d) intereses legítimos de ConfiApp compatibles con tus derechos (seguridad, prevención de fraude, mejora del servicio), sin perjuicio de las excepciones al consentimiento previstas en la Ley N° 18.331.',
      'Podés revocar el consentimiento cuando el tratamiento se funde exclusivamente en él, sin efectos retroactivos, y sin perjuicio de la licitud del tratamiento previo. La revocación puede impedir seguir usando total o parcialmente la Plataforma.',
    ],
  },
  {
    id: '7',
    title: 'Con quién compartimos datos',
    paragraphs: [
      'No comercializamos tus datos personales. Podemos comunicar o permitir el acceso a datos estrictamente necesarios a:',
    ],
    bullets: [
      'Participantes de una misma operación (comprador, vendedor y/o Agente), según el detalle de la sección siguiente.',
      'Procesadores de pago y entidades financieras (p. ej. Mercado Pago) para checkout, webhooks, OAuth de cobro y prevención de fraude; esos terceros tratan datos también conforme a sus propias políticas.',
      'Proveedores de infraestructura y servicios (hosting, bases de datos, almacenamiento de archivos, email/SMS/push, CDN, monitoreo, anti-bots, verificación de identidad) que actúan como encargados o proveedores bajo instrucciones y con medidas de seguridad adecuadas.',
      'Asesores profesionales (legales, contables) bajo deber de confidencialidad, cuando sea necesario.',
      'Autoridades administrativas o judiciales competentes, cuando exista obligación o requerimiento legal fundado, o para denunciar/prevenir delitos y proteger derechos.',
    ],
    afterItems: [
      'Los destinatarios solo deben usar los datos para las finalidades autorizadas. Si en el futuro debiéramos compartir datos con categorías distintas a las aquí descritas para nuevas finalidades, te lo informaremos y, cuando corresponda, solicitaremos consentimiento.',
    ],
  },
  {
    id: '8',
    title: 'Datos compartidos entre comprador, vendedor y Agente',
    paragraphs: [
      'ConfiApp intermedia operaciones entre tres roles posibles: comprador, vendedor y Agente independiente. El acceso a datos entre ellos está limitado a lo necesario para coordinar y ejecutar esa operación. A continuación se describe, de forma clara, qué se comparte y qué no.',
    ],
    bullets: [
      'Entre comprador y vendedor: ambos ven los datos del producto u operación (título, descripción, fotos, precio, estado, código e historial relevantes). No se intercambian entre sí, a través de la Plataforma, el nombre completo, teléfono, correo electrónico, documento de identidad, domicilio privado, datos de wallet ni métodos de cobro de la contraparte. Tampoco existe un chat directo comprador–vendedor: la comunicación operativa se canaliza mediante el Agente cuando corresponde.',
      'Del Agente hacia el comprador y el vendedor (una vez que el Agente aceptó la operación): se muestran datos de identificación y contacto del Agente necesarios para la coordinación, típicamente nombre, foto de perfil, reputación (puntuación y cantidad de reseñas) y teléfono, y se habilita el chat con el Agente. El Agente no recibe por ese canal el teléfono ni el correo del comprador o del vendedor de forma automática; la comunicación ocurre dentro de la Plataforma.',
      'Del comprador y del vendedor hacia el Agente (antes de aceptar un trabajo abierto): el Agente puede ver un resumen de la operación (código, título, descripción, monto, estado), la reputación pública y el nombre visible de las partes, y la geografía de retiro/entrega o puntos de referencia (incluyendo coordenadas cuando existan), a fin de decidir si acepta. No se exponen en ese listado el correo, el teléfono, el documento de identidad ni los datos financieros de las partes.',
      'Del comprador y del vendedor hacia el Agente (después de aceptar): el Agente accede a las instrucciones operativas de ambas partes (condiciones, checklist, puntos de encuentro o retiro/entrega e instrucciones de devolución cuando existan), al producto y al estado de la verificación/entrega, y al chat con cada parte (nombre visible, foto y, si aplica, indicación de identidad verificada).',
      'Datos que no se comparten entre participantes de la operación: contraseñas; documento de identidad (cédula u otro); correo electrónico de la contraparte; saldos, movimientos de wallet y datos bancarios o de liquidación de otro usuario; tokens de sesión; y cualquier dato de perfil no necesario para la operación, salvo que vos lo reveles voluntariamente por fuera de la Plataforma.',
      'Invitaciones y enlaces: quien recibe un enlace de invitación a una operación puede ver un preview limitado (por ejemplo nombre del creador y datos del producto/monto), sin acceso a los datos sensibles de las partes.',
      'Uso restringido: los datos que recibís de otros participantes solo pueden usarse para ejecutar o resolver esa operación. Queda prohibido usarlos con fines comerciales ajenos, spam, hostigamiento u otros usos ilícitos o ajenos a la relación generada en la Plataforma, conforme también a los Términos y Condiciones.',
    ],
    afterItems: [
      'ConfiApp puede conservar y tratar internamente el conjunto de datos de la operación (incluidos los de todas las partes) para prestar el servicio, prevenir fraude, atender disputas, soporte y cumplir obligaciones legales, sin que ello implique revelar a una parte los datos privados de otra más allá de lo descrito en esta sección.',
    ],
  },
  {
    id: '9',
    title: 'Transferencias internacionales',
    paragraphs: [
      'La infraestructura de la Plataforma puede utilizar servidores o servicios en la nube ubicados fuera de Uruguay (por ejemplo, proveedores internacionales de hosting, correo o observabilidad). En esos casos puede haber transferencia internacional de datos.',
      'Cuando el país o proveedor receptor no ofrezca un nivel de protección adecuado según la normativa aplicable, procuraremos adoptar salvaguardas contractuales u organizativas razonables (cláusulas, medidas técnicas y de seguridad) y cumplir los requisitos de la Ley N° 18.331 y de la URCDP, incluyendo autorizaciones cuando correspondan.',
      'Al usar la Plataforma y aceptar esta Política, reconocés la posibilidad de dichas transferencias en la medida necesaria para operar el servicio.',
    ],
  },
  {
    id: '10',
    title: 'Conservación de los datos y eliminación de cuenta',
    paragraphs: [
      'Mientras tu cuenta permanezca activa, conservamos los datos personales asociados a tu perfil, operaciones, chats, reputación, pagos/wallet y registros técnicos necesarios para prestar el servicio, prevenir fraude, atender disputas y cumplir obligaciones legales, contables y de seguridad. En la operación habitual de la Plataforma esos datos no se eliminan automáticamente por el solo transcurso del tiempo.',
      'Podés solicitar la eliminación de tu cuenta —y con ello el cese del tratamiento ordinario de tu perfil de acceso— desde Mi perfil → pestaña Perfil → Zona de peligro, confirmando mediante la escritura de la palabra «Eliminar». Al confirmar, la cuenta queda suspendida por treinta (30) días: si iniciás sesión nuevamente dentro de ese período, la cuenta se recupera automáticamente y el tratamiento continúa. Pasados los treinta (30) días sin recuperación, la eliminación de la cuenta es definitiva: se anonimiza el perfil de acceso (por ejemplo, correo, teléfono, documento y datos de contacto del titular) y se cierra de forma permanente el acceso a la Plataforma con esa cuenta.',
      'La solicitud de eliminación será rechazada —y no podrá forzarse ni omitirse desde la aplicación— cuando existan situaciones que exijan conservar la cuenta operativa o los datos asociados, en particular: (a) operaciones en curso o en disputa en las que participes como comprador o vendedor; (b) trabajos de Agente aceptados y aún activos; (c) saldo en la wallet (disponible, pendiente o retenido); (d) retiros de fondos pendientes o en proceso; y/o (e) comisiones de Agente pendientes, disponibles, reservadas o bloqueadas. Estas validaciones se aplican en los sistemas de ConfiApp y se reiteran antes de la eliminación definitiva.',
      'La eliminación definitiva de la cuenta no significa que tus datos personales queden eliminados por completo de la base de datos. ConfiApp podrá conservar —por el tiempo indispensable— la información necesaria para resolver disputas, atender eventuales investigaciones requeridas por el ministerio público u otras autoridades competentes, y cumplir obligaciones legales, contables, de auditoría financiera, evidencias y seguridad. Datos desvinculados o agregados podrán usarse con fines estadísticos o de mejora del servicio. El detalle operativo de la eliminación de cuenta también consta en los Términos y Condiciones.',
      'Independientemente de la eliminación de cuenta en la app, podés ejercer derechos de acceso, rectificación, actualización, inclusión o supresión escribiendo a privacidad@confiapp.app. Conforme a la Ley N° 18.331, atenderemos o rechazaremos fundadamente esas solicitudes en un plazo máximo de cinco (5) días hábiles desde su recepción, acreditada la identidad del titular, sin perjuicio de las limitaciones legales a la supresión cuando deban conservarse datos por obligaciones o derechos legítimos.',
      'Ciertos registros técnicos o de seguridad tienen plazos propios de rotación (por ejemplo, tokens de sesión, estados temporales de autenticación u OAuth, y logs de eventos de pago con retención limitada). Esos plazos no sustituyen la conservación del historial operativo y financiero descrito arriba.',
    ],
  },
  {
    id: '11',
    title: 'Seguridad',
    paragraphs: [
      'Aplicamos medidas técnicas y organizativas razonables para proteger los datos frente a acceso no autorizado, pérdida, alteración o divulgación indebida (control de acceso, cifrado en tránsito cuando corresponde, hashing de secretos, registro de eventos relevantes, entre otras).',
      'Ningún sistema es absolutamente seguro. Si tomáramos conocimiento de una vulneración de seguridad que afecte datos personales, actuaremos conforme a la normativa aplicable, incluyendo —cuando corresponda— comunicación a los titulares y a la URCDP, y coordinación con CERTuy según las reglas vigentes.',
      'Sos responsable de mantener la confidencialidad de tus credenciales y de notificarnos usos no autorizados de tu cuenta.',
    ],
  },
  {
    id: '12',
    title: 'Tus derechos',
    paragraphs: [
      'Como titular de datos personales, conforme a la Ley N° 18.331 podés ejercer, entre otros, los derechos de información, acceso, actualización, rectificación, inclusión, supresión e impugnación de valoraciones personales automatizadas, en los términos y con las limitaciones que fija la ley.',
      'El derecho de acceso es gratuito con la periodicidad que establece la normativa (en general, una vez cada seis meses, salvo interés legítimo fundado). Las solicitudes de rectificación, actualización o supresión deben atenderse o rechazarse fundadamente en el plazo legal (habitualmente cinco días hábiles).',
      'Para ejercerlos, escribinos a privacidad@confiapp.app acreditando tu identidad y precisando el derecho que querés ejercer. También podés actualizar muchos datos desde tu perfil en la Plataforma y, cuando corresponda, solicitar la eliminación de tu cuenta desde Zona de peligro, conforme a la sección de conservación y a los Términos y Condiciones (incluyendo el período de gracia, las causales de rechazo y la eventual conservación de datos para disputas, ministerio público y obligaciones legales).',
      'Si considerás que el tratamiento no se ajusta a la ley, podés denunciar o consultar ante la URCDP (https://www.gub.uy/unidad-reguladora-control-datos-personales/) y, cuando corresponda, ejercer la acción de habeas data.',
    ],
  },
  {
    id: '13',
    title: 'Menores de edad',
    paragraphs: [
      'La Plataforma está dirigida a personas con capacidad legal para contratar conforme a la legislación uruguaya (en general, mayores de dieciocho años). No recopilamos de forma consciente datos de menores. Si detectamos un registro indebido, podremos suspenderlo o eliminarlo.',
    ],
  },
  {
    id: '14',
    title: 'Datos sensibles y biometría',
    paragraphs: [
      'No solicitamos de forma ordinaria datos sensibles en el sentido de la Ley N° 18.331. Si en el futuro se habilitaran tratamientos biométricos u otros datos sensibles (por ejemplo, para verificación de identidad avanzada), se informará de manera específica y se recabará el consentimiento reforzado que exija la normativa, salvo excepciones legales.',
    ],
  },
  {
    id: '15',
    title: 'Decisiones automatizadas',
    paragraphs: [
      'Podemos utilizar reglas o sistemas automatizados o semiautomatizados para prevención de fraude, puntuación de riesgo, moderación o priorización de trabajos. Cuando la normativa lo exija, podrás solicitar información sobre criterios relevantes e impugnar valoraciones personales que te afecten significativamente, sin perjuicio de las excepciones legales.',
    ],
  },
  {
    id: '16',
    title: 'Cookies y tecnologías similares',
    paragraphs: [
      'Utilizamos almacenamiento local y cookies o tecnologías equivalentes necesarias para autenticación, seguridad y funcionamiento del servicio. Si incorporamos cookies analíticas o de marketing no esenciales, te informaremos y, cuando corresponda, solicitaremos consentimiento o ofreceremos mecanismos de gestión.',
    ],
  },
  {
    id: '17',
    title: 'Cambios a esta Política',
    paragraphs: [
      'Podemos actualizar esta Política para reflejar cambios legales, técnicos o del servicio. La fecha de actualización se indica al inicio del documento. Cuando los cambios sean relevantes, los comunicaremos por medios razonables (aviso en la Plataforma y/o email). El uso continuado tras la entrada en vigencia podrá implicar aceptación de la versión actualizada, sin perjuicio de derechos irrenunciables.',
    ],
  },
  {
    id: '18',
    title: 'Legislación y jurisdicción',
    paragraphs: [
      'Esta Política se interpreta conforme a las leyes de la República Oriental del Uruguay. Nada de lo aquí previsto implica renuncia a derechos irrenunciables de consumidores o titulares de datos.',
    ],
  },
  {
    id: '19',
    title: 'Aceptación',
    paragraphs: [
      'Al crear una cuenta y marcar la casilla de aceptación en el registro, o al continuar utilizando la Plataforma cuando la ley lo permita, declarás haber leído y aceptado esta Política de Privacidad junto con los Términos y Condiciones.',
    ],
  },
];
