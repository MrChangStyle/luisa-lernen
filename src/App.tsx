import { useRef, useState } from 'react'
import { SAMPLE_LESSON } from './data/sampleLesson'
import { requestLesson, requestPage, shrinkPhoto, type LessonAsk } from './logic/api'
import type { CheckResult } from './logic/check'
import { addEgg } from './logic/farm'
import { dayKey, moodText } from './logic/mood'
import { Family, PinGate } from './screens/Family'
import { FarmScreen } from './screens/Farm'
import { Home } from './screens/Home'
import { Camera, Done, Problem, StepScreen, Waiting } from './screens/Learn'
import { PageScreen, type TaskStatus } from './screens/Page'
import { SUBJECTS } from './data/subjects'
import { LessonsScreen, OpenScreen, PhotosScreen, PracticeMenu, SelectionScreen, SubjectScreen } from './screens/Practice'
import { learnerOf, type Child, type FamilyInfo } from './logic/learner'
import { archiveAttempts, clock, lessonOverview, passedBefore, restoreAttempt, useSaved, withEvent, withLesson, type Attempt } from './state'
import { VERSION_LABEL, type Lesson, type Page } from './types'

const subjectOf = (topic: string) => Object.keys(SUBJECTS).find((k) => SUBJECTS[k].some((t) => t.name === topic)) ?? 'Mathe'

// Ein Auftrag an die KI: was sie erstellen soll und wohin es danach geht
// page-file: Foto einer Seite, die KI listet nur die Aufgaben darauf. Sonst erstellt sie einen Lernpfad.
interface Job {
  ask: LessonAsk | { mode: 'page-file'; file: File }
  how: string
  waitText: string
  back: ScreenName
  practiceKey?: string
  // Aufgabe von einer gescannten Seite: der Lernpfad wird dort vermerkt
  pageTask?: { pageId: string; index: number }
}

type ScreenName =
  | 'home'
  | 'camera'
  | 'page'
  | 'step'
  | 'done'
  | 'waiting'
  | 'problem'
  | 'practice'
  | 'subject'
  | 'selection'
  | 'open'
  | 'photos'
  | 'lessons'
  | 'farm'
  | 'pin'
  | 'family'

interface AppProps {
  child: Child
  family: FamilyInfo
  setFamily: (fn: (f: FamilyInfo) => FamilyInfo) => void
  // Familienbereich: dieses Gerät einem anderen Kind zuordnen
  onAssignDevice: (id: string) => void
}

// Die App eines Kindes. Root baut sie pro Kind neu auf, damit sich die Stände nie vermischen.
export default function App({ child, family, setFamily, onAssignDevice }: AppProps) {
  const [saved, setSaved, cloud] = useSaved(child.id)
  const learner = learnerOf(child)
  // Gemeinsame Eltern-PIN; ältere Stände haben sie noch in Luisas Lernstand
  const pin = family.pin ?? saved.parentPin
  const [screen, setScreen] = useState<ScreenName>('home')
  const [mood, setMood] = useState(() => saved.mood[dayKey(new Date())]?.value ?? 50)
  const [moodTouched, setMoodTouched] = useState(false)
  const [subject, setSubject] = useState('Mathe')
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  // Pro Schritt gemerkt, damit das Kind zurückgehen kann und ihre Antworten sichtbar bleiben
  const [versions, setVersions] = useState<number[]>([])
  const [results, setResults] = useState<(CheckResult | null)[]>([])
  const [reward, setReward] = useState<string[]>([])
  const [gotEgg, setGotEgg] = useState(true)
  const [lessonId, setLessonId] = useState<string>(SAMPLE_LESSON.id)
  const [job, setJob] = useState<Job | null>(null)
  const [problem, setProblem] = useState<{ text: string; retry: 'again' | 'photo'; detail?: string } | null>(null)
  const [practiceKey, setPracticeKey] = useState<string | null>(null)
  const [pageId, setPageId] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)

  const lessons: Record<string, Lesson> = { [SAMPLE_LESSON.id]: SAMPLE_LESSON, ...saved.lessons }
  const lesson = lessons[lessonId] ?? SAMPLE_LESSON
  const version = versions[stepIndex] ?? 0
  const result = results[stepIndex] ?? null
  const setVersion = (v: number) => setVersions((old) => Object.assign([...old], { [stepIndex]: v }))
  const setResult = (r: CheckResult | null) => setResults((old) => Object.assign([...old], { [stepIndex]: r }))
  const today = dayKey(new Date())
  const todayMood = saved.mood[today]

  // Stimmung wird einmal pro Tag gespeichert, sobald das Kind nach dem Einstellen mit dem Lernen anfängt
  const saveMoodIfNeeded = () => {
    if (!moodTouched || todayMood) return
    const at = new Date().toISOString()
    setSaved((s) => withEvent({ ...s, mood: { ...s.mood, [today]: { value: mood, at } } }, `Stimmung des Tages gespeichert: „${moodText(mood)}“`))
  }

  // Einmal am Tag: Stimmung selbst bestätigen gibt 1 Ei
  const confirmMood = () => {
    if (todayMood?.egg) return
    const { farm, messages } = addEgg(saved.farm)
    const at = new Date().toISOString()
    setSaved((s) =>
      withEvent(
        { ...s, farm, mood: { ...s.mood, [today]: { value: mood, at, egg: true } } },
        `Stimmung bestätigt: „${moodText(mood)}“, 1 Ei bekommen${messages.length ? '. ' + messages.join(' ') : ''}`,
      ),
    )
  }

  const updateAttempt = (fn: (a: Attempt) => Attempt) =>
    setSaved((s) => ({ ...s, attempts: s.attempts.map((a) => (a.id === attemptId ? fn(a) : a)) }))

  const updateStat = (fn: (st: Attempt['stats'][number]) => Attempt['stats'][number]) =>
    updateAttempt((a) => ({ ...a, stats: a.stats.map((st, i) => (i === stepIndex ? fn(st) : st)) }))

  // Lässt die KI einen Lernpfad erstellen oder eine fotografierte Seite lesen
  const run = async (j: Job) => {
    abort.current?.abort()
    const ctrl = new AbortController()
    abort.current = ctrl
    setJob(j)
    setScreen('waiting')
    try {
      const answer = j.ask.mode === 'page-file' ? await requestPage(await shrinkPhoto(j.ask.file), learner, ctrl.signal) : await requestLesson(j.ask, learner, ctrl.signal)
      if (ctrl.signal.aborted) return
      if ('page' in answer) {
        const page: Page = { id: crypto.randomUUID(), at: new Date().toISOString(), ...answer.page }
        setSaved((s) => withEvent({ ...s, pages: { ...s.pages, [page.id]: page } }, `Seite fotografiert: ${page.subject}, „${page.title}“ (${page.tasks.length} Aufgaben)`))
        setPageId(page.id)
        setScreen('page')
      } else if ('lesson' in answer) {
        const l = answer.lesson
        const pt = j.pageTask
        setSaved((s) => {
          const next = withLesson(s, l)
          const page = pt && next.pages[pt.pageId]
          if (!page) return next
          const tasks = page.tasks.map((t, i) => (i === pt.index ? { ...t, lessonId: l.id } : t))
          return { ...next, pages: { ...next.pages, [page.id]: { ...page, tasks } } }
        })
        setLessonId(l.id)
        setPracticeKey(j.practiceKey ?? null)
        startLesson(l, j.how, !!pt)
      } else if ('problem' in answer) {
        setProblem({ text: answer.problem, retry: 'photo' })
        setScreen('problem')
      } else {
        setProblem({ text: answer.error, retry: 'again', detail: answer.detail })
        setScreen('problem')
      }
    } catch {
      if (ctrl.signal.aborted) return
      setProblem({ text: 'Das Foto konnte nicht geöffnet werden. Mache bitte ein neues Foto.', retry: 'photo' })
      setScreen('problem')
    }
  }

  // Eine Aufgabe von einer gescannten Seite. Gibt es den Lernpfad schon, braucht es die KI nicht noch einmal.
  const startPageTask = (page: Page, index: number) => {
    const task = page.tasks[index]
    const known = task.lessonId ? lessons[task.lessonId] : undefined
    setPageId(page.id)
    if (known) {
      setLessonId(known.id)
      setPracticeKey(null)
      startLesson(known, passedBefore(saved, known.id) ? 'Aufgabe von der Seite wiederholt' : 'Aufgabe von der Seite weitergemacht', true)
      return
    }
    run({
      ask: { mode: 'task', subject: page.subject, topic: task.topic, text: task.text, source: `${page.title}, ${task.label}` },
      how: 'Aufgabe von der Seite gewählt',
      waitText: `Ich bereite „${task.label}“ vor.`,
      back: 'page',
      pageTask: { pageId: page.id, index },
    })
  }

  const taskStatus = (page: Page): TaskStatus[] =>
    page.tasks.map((t) => (!t.lessonId ? 'neu' : passedBefore(saved, t.lessonId) ? 'bestanden' : saved.attempts.some((a) => a.lessonId === t.lessonId) ? 'angefangen' : 'neu'))

  const cancel = () => {
    abort.current?.abort()
    setScreen(job?.back ?? 'home')
  }

  const startTopic = (subj: string, topic: string, back: ScreenName, how: string) =>
    run({ ask: { mode: 'topic', subject: subj, topic }, how, waitText: `Ich denke mir eine Aufgabe zu „${topic}“ aus.`, back })

  const startLesson = (l: Lesson, how: string, photo = false) => {
    const id = crypto.randomUUID()
    const attempt: Attempt = {
      id,
      lessonId: l.id,
      subject: l.subject,
      topic: l.topic,
      source: l.source,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      stats: l.steps.map(() => ({ again: 0, wrong: [], helped: null })),
      photo,
    }
    setSaved((s) => withEvent({ ...s, attempts: [...s.attempts, attempt] }, `${how}: ${l.subject}, ${l.topic}`))
    setAttemptId(id)
    setStepIndex(0)
    setVersions([])
    setResults([])
    setScreen('step')
  }

  const onResult = (r: CheckResult) => {
    setResult(r)
    const v = lesson.steps[stepIndex].versions[version].key
    if (r.status === 'ok') {
      updateStat((st) => ({ ...st, helped: v }))
      setSaved((s) => withEvent(s, `Schritt ${stepIndex + 1}: Eingabe passt (Erklärung „${VERSION_LABEL[v]}“)`))
    } else if (r.status === 'no') {
      updateStat((st) => ({ ...st, wrong: [...st.wrong, r.given] }))
      setSaved((s) => withEvent(s, `Schritt ${stepIndex + 1}: Eingabe „${r.given}“ passte nicht`))
    }
  }

  const onAgain = () => {
    const next = (version + 1) % lesson.steps[stepIndex].versions.length
    setVersion(next)
    if (result?.status !== 'ok') setResult(null)
    updateStat((st) => ({ ...st, again: st.again + 1 }))
    setSaved((s) => withEvent(s, `Schritt ${stepIndex + 1}: „Erklär es mir nochmal“ → ${VERSION_LABEL[lesson.steps[stepIndex].versions[next].key]}`))
  }

  const onStop = () => {
    setSaved((s) => withEvent(s, `Aufgabe bei Schritt ${stepIndex + 1} beendet`))
    setScreen('home')
  }

  const onGoTo = (i: number) => {
    setStepIndex(i)
    setSaved((s) => withEvent(s, `Zurück zu Schritt ${i + 1}`))
  }

  const onNext = () => {
    if (stepIndex < lesson.steps.length - 1) {
      setStepIndex(stepIndex + 1)
      return
    }
    // Ein Ei gibt es pro Aufgabe nur beim ersten Bestehen. Wiederholen ist Übung ohne neues Tier.
    const first = !passedBefore(saved, lesson.id, attemptId)
    const { farm, messages } = first ? addEgg(saved.farm) : { farm: saved.farm, messages: [] }
    setReward(messages)
    setGotEgg(first)
    updateAttempt((a) => ({ ...a, finishedAt: new Date().toISOString() }))
    const done = practiceKey
    setSaved((s) =>
      withEvent(
        { ...s, farm, donePractice: done && !s.donePractice.includes(done) ? [...s.donePractice, done] : s.donePractice },
        first ? `Aufgabe fertig, 1 Ei bekommen${messages.length ? '. ' + messages.join(' ') : ''}` : 'Aufgabe wiederholt und fertig (kein neues Ei, schon einmal bestanden)',
      ),
    )
    setPracticeKey(null)
    setScreen('done')
  }

  // Offene Übungen: die zwei neuen Aufgaben jedes fertigen Lernpfads, die das Kind noch nicht gemacht hat
  const current = saved.attempts.filter((a) => !a.archivedAt)
  const finishedLessons = [...new Set(current.filter((a) => a.finishedAt).map((a) => a.lessonId))]
    .map((id) => lessons[id])
    .filter(Boolean)
    .map((l) => ({ ...l, practice: l.practice.filter((p) => !saved.donePractice.includes(`${l.id}#${p.text}`)) }))
    .filter((l) => l.practice.length > 0)
  // Ältere Einträge ohne Merkmal stammen aus der Testversion, in der jede Aufgabe ein Foto war
  const pageLessons = new Set(Object.values(saved.pages).flatMap((p) => p.tasks.map((t) => t.lessonId)))
  const photoAttempts = current.filter((a) => (a.photo ?? a.lessonId === SAMPLE_LESSON.id) && !pageLessons.has(a.lessonId))
  const pages = Object.values(saved.pages).sort((a, b) => b.at.localeCompare(a.at))
  const page = pageId ? saved.pages[pageId] : undefined
  // Fertig-Bildschirm: Gehört die Aufgabe zu einer Seite, kommen die übrigen Aufgaben davon als Nächstes
  const donePage = Object.values(saved.pages).find((p) => p.tasks.some((t) => t.lessonId === lesson.id))
  const overview = lessonOverview(saved)
  const practiced = new Set(current.filter((a) => a.finishedAt).map((a) => a.topic))

  switch (screen) {
    case 'home':
      return (
        <Home
          name={child.name}
          mood={mood}
          moodSavedAt={todayMood ? clock(todayMood.at) : null}
          moodEgg={!!todayMood?.egg}
          onConfirmMood={confirmMood}
          onMood={(v) => {
            setMood(v)
            setMoodTouched(true)
          }}
          go={(s) => {
            if (s === 'camera' || s === 'practice') saveMoodIfNeeded()
            setScreen(s === 'family' ? 'pin' : s)
          }}
        />
      )
    case 'camera':
      return (
        <Camera
          onPhoto={(file) => run({ ask: { mode: 'page-file', file }, how: 'Seite fotografiert', waitText: 'Ich lese deine Seite.', back: 'camera' })}
          onBack={() => setScreen('home')}
        />
      )
    case 'waiting':
      return <Waiting key={job?.waitText} text={job?.waitText ?? ''} onCancel={cancel} />
    case 'problem':
      return (
        <Problem
          text={problem?.text ?? ''}
          detail={problem?.detail}
          retry={problem?.retry === 'photo' ? 'Neues Foto machen' : 'Nochmal versuchen'}
          onRetry={() => (problem?.retry === 'photo' ? setScreen('camera') : job && run(job))}
          onBack={() => setScreen(job?.back === 'camera' ? 'home' : (job?.back ?? 'home'))}
        />
      )
    case 'page':
      return page ? <PageScreen page={page} status={taskStatus(page)} onPick={(i) => startPageTask(page, i)} onBack={() => setScreen('home')} /> : null
    case 'step':
      return <StepScreen readAloud={child.helps.includes('vorlesen')} lesson={lesson} index={stepIndex} version={version} results={results} onGoTo={onGoTo} onAgain={onAgain} onResult={onResult} onNext={onNext} onStop={onStop} />
    case 'done':
      return (
        <Done
          lesson={lesson}
          farm={saved.farm}
          egg={gotEgg}
          rewardMessages={reward}
          next={
            donePage && {
              page: donePage,
              status: taskStatus(donePage),
              only: donePage.tasks.flatMap((t, i) => (t.lessonId === lesson.id || taskStatus(donePage)[i] === 'bestanden' ? [] : [i])),
              onPick: (i) => startPageTask(donePage, i),
            }
          }
          onFarm={() => setScreen('farm')}
          onHome={() => setScreen('home')}
        />
      )
    case 'practice':
      return (
        <PracticeMenu
          selection={saved.selection}
          openCount={finishedLessons.reduce((n, l) => n + l.practice.length, 0)}
          photoCount={pages.length + photoAttempts.length}
          lessonCount={overview.length}
          onSubject={(s) => {
            setSubject(s)
            setScreen('subject')
          }}
          go={setScreen}
        />
      )
    case 'subject':
      return (
        <SubjectScreen
          subject={subject}
          selection={saved.selection}
          practiced={practiced}
          onStart={(t) => startTopic(subject, t, 'subject', `Übung gestartet (${subject})`)}
          onSubject={setSubject}
          onToggle={(t) =>
            setSaved((s) =>
              s.selection.includes(t) ? { ...s, selection: s.selection.filter((x) => x !== t) } : withEvent({ ...s, selection: [...s.selection, t] }, `Übungsbereich: „${t}“ ausgewählt`),
            )
          }
          onBack={() => setScreen('practice')}
        />
      )
    case 'selection':
      return (
        <SelectionScreen
          selection={saved.selection}
          onStart={(t) => startTopic(subjectOf(t), t, 'selection', 'Übung aus „Meine Auswahl“ gestartet')}
          onChange={(next) => setSaved((s) => ({ ...s, selection: next }))}
          onBack={() => setScreen('practice')}
        />
      )
    case 'open':
      return (
        <OpenScreen
          lessons={finishedLessons}
          onStart={(l, text) =>
            run({
              ask: { mode: 'task', subject: l.subject, topic: l.topic, text },
              how: 'Offene Übung gestartet',
              waitText: 'Ich bereite deine Übung vor.',
              back: 'open',
              practiceKey: `${l.id}#${text}`,
            })
          }
          onBack={() => setScreen('practice')}
        />
      )
    case 'lessons':
      return <LessonsScreen entries={overview} onStart={(l, passed) => startLesson(l, passed ? 'Aufgabe wiederholt' : 'Aufgabe weitergemacht')} onBack={() => setScreen('practice')} />
    case 'photos':
      return (
        <PhotosScreen
          pages={pages}
          attempts={photoAttempts}
          onPage={(p) => {
            setPageId(p.id)
            setScreen('page')
          }}
          onBack={() => setScreen('practice')}
        />
      )
    case 'farm':
      return <FarmScreen farm={saved.farm} onBack={() => setScreen('home')} />
    case 'pin':
      return (
        <PinGate
          pin={pin}
          name={child.name}
          onSetPin={(p) => setFamily((f) => ({ ...f, pin: p }))}
          onOk={() => {
            // Luisas bisherige PIN wird beim ersten Öffnen zur gemeinsamen PIN der Familie
            if (!family.pin && pin) setFamily((f) => ({ ...f, pin }))
            setScreen('family')
          }}
          onBack={() => setScreen('home')}
        />
      )
    case 'family':
      return <Family child={child} family={family} setFamily={setFamily} onAssignDevice={onAssignDevice} saved={saved} cloud={cloud} lessons={lessons} onArchive={(ids) => setSaved((s) => archiveAttempts(s, ids))}
          onRestore={(id) => setSaved((s) => restoreAttempt(s, id))} onBack={() => setScreen('home')} />
  }
}
