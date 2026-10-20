import type { Lesson } from '../types'

// Beispielaufgabe aus dem Konzept. Ersetzt später den Lernpfad, den der Server aus Luisas Foto erstellt.
export const SAMPLE_LESSON: Lesson = {
  id: 'mathe-brueche-pizza',
  subject: 'Mathe',
  topic: 'Brüche addieren',
  source: 'Aufgabe 4 (S. 37)',
  task: 'Lena isst {1/4} einer Pizza. Tom isst {2/3} derselben Pizza. Welchen Teil der Pizza haben die beiden zusammen gegessen?',
  parentSolution: '1/4 + 2/3 = 3/12 + 8/12 = 11/12',
  steps: [
    {
      title: 'Was ist gefragt?',
      versions: [
        {
          key: 'worte',
          text: 'Die Aufgabe fragt: Wie groß ist der Teil der Pizza, den Lena und Tom **zusammen** gegessen haben?\n\n„Zusammen“ bedeutet in dieser Aufgabe: Wir zählen beide Teile zusammen. Wir rechnen also eine Plus-Aufgabe mit den beiden Brüchen.',
        },
        {
          key: 'bild',
          text: 'Lena hat ein Stück Pizza auf ihrem Teller. Tom hat ein Stück auf seinem Teller. Wir legen beide Stücke auf **einen** Teller.\n\nDie Frage ist: Wie viel Pizza liegt jetzt auf diesem einen Teller? Das Zusammenlegen ist eine Plus-Aufgabe.',
        },
        {
          key: 'regel',
          text: '**Regel:** Wenn eine Textaufgabe fragt, wie viel es „zusammen“ ist, dann addierst du (Plus).\n\nHier: {1/4} + {2/3}',
        },
      ],
      why: 'Bevor man rechnet, muss klar sein, welche Rechenart gebraucht wird. Sonst rechnet man richtig, aber die falsche Aufgabe.',
      check: {
        type: 'choice',
        question: 'Welche Rechenart brauchst du?',
        options: ['+', '−', '·', ':'],
        answer: '+',
        hint: '„{x}“ passt hier nicht. Lies nochmal das Wort „zusammen“ in der Aufgabe.',
      },
    },
    {
      title: 'Warum kann ich nicht sofort rechnen?',
      versions: [
        {
          key: 'worte',
          text: 'Der [[Nenner]] sagt, in wie viele gleich große Stücke die Pizza geteilt ist.\n\nBei {1/4} ist die Pizza in 4 Stücke geteilt. Bei {2/3} ist sie in 3 Stücke geteilt. Die Stücke sind also verschieden groß.\n\nVerschieden große Stücke kann man nicht einfach zusammenzählen.',
        },
        {
          key: 'bild',
          text: 'Ein Viertel-Stück ist kleiner als ein Drittel-Stück. Wenn man sagt „1 Stück und 2 Stücke sind 3 Stücke“, weiß niemand, wie groß diese 3 Stücke sind.',
          graphic: {
            kind: 'pizza',
            parts: [
              { slices: 4, filled: 1, caption: 'Lena: 1 von 4' },
              { slices: 3, filled: 2, caption: 'Tom: 2 von 3' },
            ],
          },
        },
        {
          key: 'regel',
          text: '**Regel:** Brüche darf man nur addieren, wenn die [[Nenner]] gleich sind.\n\nHier sind die Nenner 4 und 3. Sie sind nicht gleich. Also müssen wir zuerst gleiche Nenner machen.',
        },
      ],
      why: 'Ein Bruch ist nur dann eindeutig, wenn klar ist, wie groß ein Stück ist. Das bestimmt der Nenner.',
      check: {
        type: 'choice',
        question: 'Sind die Nenner der beiden Brüche gleich?',
        options: ['Ja', 'Nein'],
        answer: 'Nein',
        hint: 'Schau dir die Zahlen unter den Bruchstrichen an. Es sind 4 und 3.',
      },
    },
    {
      title: 'Gemeinsamen Nenner finden',
      versions: [
        {
          key: 'worte',
          text: 'Wir suchen eine Zahl, die in der 4er-Reihe **und** in der 3er-Reihe vorkommt.\n\nSchreibe beide Reihen auf ein Blatt:\n4er-Reihe: 4, 8, …\n3er-Reihe: 3, 6, …\n\nDie kleinste Zahl, die in beiden Reihen steht, ist der gemeinsame [[Nenner]].',
        },
        {
          key: 'bild',
          text: 'Wir schneiden die Pizza in so viele gleich große Stücke, dass beide Einteilungen hineinpassen.\n\nDie Anzahl der Stücke muss sich also durch 4 teilen lassen **und** durch 3 teilen lassen, ohne Rest.',
        },
        {
          key: 'regel',
          text: '**Rechenweg:**\n\n1. [[Vielfache]] von 4 aufschreiben.\n2. Vielfache von 3 aufschreiben.\n3. Die kleinste Zahl nehmen, die in beiden Listen steht. Sie heißt [[Hauptnenner]].',
        },
      ],
      why: 'Mit einem gemeinsamen Nenner sind alle Stücke gleich groß. Dann darf man zusammenzählen.',
      check: {
        type: 'number',
        question: 'Welche Zahl ist der gemeinsame Nenner?',
        answer: 12,
        okText: 'Das passt. Die Zahl steht in der 4er-Reihe und in der 3er-Reihe.',
        largerMultipleHint:
          'Diese Zahl funktioniert auch. Es gibt aber eine kleinere Zahl, die in beiden Reihen steht. Mit der kleinsten Zahl wird das Rechnen leichter.',
        hint: '{x} steht nicht in beiden Reihen. Prüfe: Lässt sich {x} durch 4 teilen? Lässt sich {x} durch 3 teilen?',
      },
    },
    {
      title: 'Die Brüche erweitern',
      versions: [
        {
          key: 'worte',
          text: '[[erweitern]] bedeutet: [[Zähler]] und [[Nenner]] mit derselben Zahl malnehmen. Der Bruch bleibt dabei gleich groß.\n\nFrage für {1/4}: Mit welcher Zahl muss ich 4 malnehmen, damit 12 herauskommt? Mit genau dieser Zahl nimmst du auch den Zähler 1 mal.\n\nDasselbe machst du danach für {2/3}.',
        },
        {
          key: 'bild',
          text: 'Stell dir vor, du schneidest jedes Viertel-Stück in gleich große kleinere Stücke, bis es Zwölftel sind.\n\nLenas Pizza-Menge ändert sich dabei nicht. Sie hat nur mehr, aber kleinere Stücke. Zähle: Wie viele Zwölftel-Stücke sind es jetzt?',
        },
        {
          key: 'regel',
          text: '**Regel:** Nenner mal Zahl = 12. Zähler mal **dieselbe** Zahl.\n\n{1/4}: 4 · ? = 12, dann 1 · ? = neuer Zähler\n{2/3}: 3 · ? = 12, dann 2 · ? = neuer Zähler',
        },
      ],
      why: 'Damit beide Brüche den Nenner 12 haben und trotzdem gleich viel Pizza bedeuten wie vorher.',
      check: {
        type: 'numerators',
        question: 'Trage die neuen Zähler ein:',
        fractions: [
          [1, 4],
          [2, 3],
        ],
        denominator: 12,
        answers: [3, 8],
        okText: 'Beide Zähler passen. Jetzt haben beide Brüche den Nenner 12.',
        hints: [
          'Der erste Zähler passt noch nicht. Mit welcher Zahl hast du die 4 malgenommen? Nimm die 1 mit derselben Zahl mal.',
          'Der zweite Zähler passt noch nicht. Mit welcher Zahl hast du die 3 malgenommen? Nimm die 2 mit derselben Zahl mal.',
        ],
      },
    },
    {
      title: 'Zusammenzählen',
      versions: [
        {
          key: 'worte',
          text: 'Jetzt haben beide Brüche den gleichen [[Nenner]]. Du addierst nur die [[Zähler]]. Der Nenner bleibt gleich.\n\nAm Ende prüfst du: Kann man das Ergebnis kürzen?',
        },
        {
          key: 'bild',
          text: 'Jetzt sind alle Stücke gleich groß: Es sind Zwölftel-Stücke.\n\nDu musst nur noch zählen, wie viele Zwölftel-Stücke Lena und Tom zusammen haben. Die Größe der Stücke ändert sich nicht.',
        },
        {
          key: 'regel',
          text: '**Regel:** {a/n} + {b/n} = {a + b/n}\n\nDer Nenner wird **nicht** addiert.',
        },
      ],
      why: 'Der Nenner sagt nur, wie groß die Stücke sind. Beim Zusammenzählen ändern sich die Stücke nicht, nur ihre Anzahl.',
      check: {
        type: 'fraction',
        question: 'Dein Ergebnis:',
        left: '{1/4} + {2/3} =',
        answer: [11, 12],
        okText: 'Dein Ergebnis passt. Du hast jeden Schritt selbst gemacht.',
        hints: [
          { denominator: 24, text: 'Du hast die Nenner addiert. Der Nenner bleibt gleich. Schau dir die Regel oben an.' },
          {
            numerator: 3,
            denominator: 7,
            text: 'Du hast Zähler und Nenner der ursprünglichen Brüche direkt addiert. Schau dir Schritt 2 an.',
          },
        ],
        wrongDenominator: 'Der Nenner passt noch nicht. Welchen gemeinsamen Nenner hast du in Schritt 3 gefunden?',
        wrongNumerator: 'Der Zähler passt noch nicht. Schau nach, welche neuen Zähler du in Schritt 4 eingetragen hast.',
      },
    },
  ],
  practice: [
    {
      text: 'Mia trinkt am Morgen {1/2} Liter Saft und am Mittag {1/3} Liter Saft. Wie viel Saft trinkt sie zusammen?',
      note: 'Gleicher Aufbau wie deine Aufgabe, andere Zahlen.',
    },
    {
      text: 'Ein Beet ist zu {2/5} mit Tomaten und zu {3/10} mit Gurken bepflanzt. Welcher Teil des Beets ist bepflanzt?',
      note: 'Etwas anders: Ein Nenner steckt schon im anderen. Dann bist du schneller.',
    },
  ],
}
