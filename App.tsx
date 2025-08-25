
import React, { useState, useEffect, useMemo, useCallback, useRef, type ReactNode, type DragEvent } from 'react';
import { GoogleGenAI } from "@google/genai";
import { type Question, type Settings, type Option, Page, Subject, Level } from './types';
import { ALL_QUESTIONS } from './data';

// --- HELPER HOOKS ---

const useLocalStorage = <T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };
  return [storedValue, setValue];
};

const useSpeech = (settings: Settings) => {
  const synth = window.speechSynthesis;
  const speak = useCallback((text: string) => {
    if (settings.isTtsEnabled && text) {
      synth.cancel(); // Cancel any previous speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      synth.speak(utterance);
    }
  }, [settings.isTtsEnabled, synth]);
  return speak;
};


// --- ICONS ---
const Icon = ({ children, className = '' }: { children: ReactNode, className?: string }) => (
    <svg className={`w-6 h-6 ${className}`} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">{children}</svg>
);
const HomeIcon = () => <Icon><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></Icon>;
const SettingsIcon = () => <Icon><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19-.15-.24-.42-.12-.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.c25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/></Icon>;
const CloseIcon = () => <Icon><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></Icon>;
const StarIcon = ({ filled = false }) => <Icon className={filled ? "text-yellow-400" : "text-gray-300"}><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></Icon>;
const SoundOnIcon = () => <Icon><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></Icon>;
const SoundOffIcon = () => <Icon><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></Icon>;


// --- UI COMPONENTS ---

const ProgressBar = ({ current, total }: { current: number, total: number }) => (
    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 my-4">
        <div className="bg-blue-500 h-4 rounded-full transition-all duration-300" style={{ width: `${(current / total) * 100}%` }}></div>
    </div>
);

const Stars = ({ count, total }: { count: number, total: number }) => (
    <div className="flex justify-center items-center gap-1">
        {Array.from({ length: total }).map((_, i) => <StarIcon key={i} filled={i < count} />)}
    </div>
);

interface DraggableItemProps {
    option: Option;
    onDragStart: (e: DragEvent<HTMLDivElement>, value: string) => void;
}
const DraggableItem = ({ option, onDragStart }: DraggableItemProps) => {
    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, option.value)}
            className={`flex items-center justify-center w-36 h-24 md:w-40 md:h-28 text-white font-bold text-2xl md:text-4xl cursor-grab active:cursor-grabbing shadow-lg transition-transform hover:scale-105 active:scale-95 rounded-xl ${option.color}`}
        >
            {option.illustration ? (
                 <img src={option.illustration} alt={option.alt || option.value} className="w-full h-full object-cover rounded-xl"/>
            ) : (
                <span>{option.value}</span>
            )}
        </div>
    );
};

interface DropZoneProps {
    onDrop: (e: DragEvent<HTMLDivElement>) => void;
    isOver: boolean;
    isCorrect: boolean | null;
}
const DropZone = ({ onDrop, isOver, isCorrect }: DropZoneProps) => {
    const baseClasses = "flex items-center justify-center w-32 h-32 md:w-40 md:h-40 border-4 border-dashed rounded-2xl transition-all duration-300";
    
    const stateClasses = useMemo(() => {
        if (isCorrect === true) return 'border-green-500 bg-green-100 dark:bg-green-900';
        if (isCorrect === false) return 'border-orange-500 bg-orange-100 dark:bg-orange-900 animate-pulse';
        if (isOver) return 'border-blue-500 bg-blue-100 dark:bg-blue-900 scale-105';
        return 'border-gray-400 dark:border-gray-600 bg-gray-200 dark:bg-gray-800';
    }, [isCorrect, isOver]);

    return (
        <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            className={`${baseClasses} ${stateClasses}`}
        >
            <span className="text-gray-500 dark:text-gray-400 text-lg">Arraste aqui</span>
        </div>
    );
};

interface FeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
    isCorrect: boolean;
    media: { src: string; type: 'video' | 'gif', alt: string };
    settings: Settings;
}
const FeedbackModal = ({ isOpen, onClose, isCorrect, media, settings }: FeedbackModalProps) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
            <div className={`relative p-8 rounded-2xl shadow-2xl text-center w-11/12 max-w-md ${isCorrect ? 'bg-green-100 dark:bg-green-900' : 'bg-orange-100 dark:bg-orange-900'}`}>
                <h2 className={`text-3xl font-bold mb-4 ${isCorrect ? 'text-green-800 dark:text-green-200' : 'text-orange-800 dark:text-orange-200'}`}>
                    {isCorrect ? 'Muito bem! Você acertou.' : 'Quase! Tente novamente.'}
                </h2>
                {!settings.reduceMotion && (
                    <img src={media.src} alt={media.alt} className="w-full max-h-64 object-contain rounded-lg my-4" />
                )}
                <button
                    onClick={onClose}
                    className={`mt-4 px-8 py-3 rounded-lg font-bold text-white text-xl transition-transform hover:scale-105 ${isCorrect ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'}`}
                >
                    {isCorrect ? 'Próximo' : 'Tentar de Novo'}
                </button>
            </div>
        </div>
    );
};

// --- PAGES ---

interface HomePageProps {
    navigateTo: (page: Page, subject?: Subject) => void;
}
const HomePage = ({ navigateTo }: HomePageProps) => {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
             <img src="https://picsum.photos/seed/avatar/150/150" alt="Mascote do App" className="w-32 h-32 rounded-full mb-6 shadow-lg border-4 border-white dark:border-gray-800" />
            <h1 className="text-5xl font-bold text-gray-800 dark:text-white mb-2">Bem-vindo ao Apprenda+</h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-12">Escolha uma matéria para começar a aprender!</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <button onClick={() => navigateTo(Page.LevelSelection, Subject.Math)} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-6 px-12 rounded-2xl text-3xl shadow-xl transition-transform hover:-translate-y-1">
                    Matemática
                </button>
                <button onClick={() => navigateTo(Page.LevelSelection, Subject.Portuguese)} className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-6 px-12 rounded-2xl text-3xl shadow-xl transition-transform hover:-translate-y-1">
                    Português
                </button>
            </div>
        </div>
    );
};

interface LevelSelectionPageProps {
    subject: Subject;
    navigateToGame: (level: Level) => void;
    navigateBack: () => void;
}
const LevelSelectionPage = ({ subject, navigateToGame, navigateBack }: LevelSelectionPageProps) => {
    const subjectColors = {
        [Subject.Math]: 'bg-blue-200 dark:bg-blue-900',
        [Subject.Portuguese]: 'bg-purple-200 dark:bg-purple-900'
    };

    return (
        <div className={`flex flex-col items-center justify-center h-full text-center p-4 ${subjectColors[subject]}`}>
            <button onClick={navigateBack} className="absolute top-4 left-4 text-gray-700 dark:text-gray-200 hover:text-black dark:hover:text-white transition">
                <HomeIcon />
            </button>
            <h1 className="text-5xl font-bold text-gray-800 dark:text-white mb-12">Selecione o Nível de {subject}</h1>
            <div className="flex flex-col md:flex-row gap-8">
                <button onClick={() => navigateToGame(Level.One)} className="bg-green-500 hover:bg-green-600 text-white font-bold py-8 px-16 rounded-2xl text-4xl shadow-xl transition-transform hover:-translate-y-1">
                    Nível 1
                </button>
                <button onClick={() => navigateToGame(Level.Two)} className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-8 px-16 rounded-2xl text-4xl shadow-xl transition-transform hover:-translate-y-1">
                    Nível 2
                </button>
            </div>
        </div>
    );
};

interface SettingsPageProps {
    settings: Settings;
    setSettings: React.Dispatch<React.SetStateAction<Settings>>;
    navigateBack: () => void;
}
const SettingsPage = ({ settings, setSettings, navigateBack }: SettingsPageProps) => {
    const toggleSetting = (key: keyof Settings) => {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <div className="flex flex-col items-center justify-center h-full p-4">
            <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-8">Configurações de Acessibilidade</h1>
            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg w-full max-w-md space-y-6">
                <div className="flex justify-between items-center">
                    <label htmlFor="tts" className="text-xl text-gray-700 dark:text-gray-200">Narrador de Texto (TTS)</label>
                    <button onClick={() => toggleSetting('isTtsEnabled')} className={`p-2 rounded-full ${settings.isTtsEnabled ? 'text-green-500' : 'text-gray-400'}`}>
                        {settings.isTtsEnabled ? <SoundOnIcon /> : <SoundOffIcon />}
                    </button>
                </div>
                <div className="flex justify-between items-center">
                    <label htmlFor="contrast" className="text-xl text-gray-700 dark:text-gray-200">Alto Contraste</label>
                    <div onClick={() => toggleSetting('isHighContrast')} className={`w-14 h-8 flex items-center rounded-full p-1 cursor-pointer ${settings.isHighContrast ? 'bg-blue-600' : 'bg-gray-300'}`}>
                        <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform ${settings.isHighContrast ? 'translate-x-6' : ''}`}></div>
                    </div>
                </div>
                <div className="flex justify-between items-center">
                    <label htmlFor="motion" className="text-xl text-gray-700 dark:text-gray-200">Reduzir Animações</label>
                    <div onClick={() => toggleSetting('reduceMotion')} className={`w-14 h-8 flex items-center rounded-full p-1 cursor-pointer ${settings.reduceMotion ? 'bg-blue-600' : 'bg-gray-300'}`}>
                        <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform ${settings.reduceMotion ? 'translate-x-6' : ''}`}></div>
                    </div>
                </div>
            </div>
             <button onClick={navigateBack} className="mt-12 bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-8 rounded-lg text-xl shadow-lg transition-transform hover:scale-105">
                Voltar
            </button>
        </div>
    );
};


interface GamePageProps {
    subject: Subject;
    level: Level;
    settings: Settings;
    navigateHome: () => void;
}

const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

const GamePage = ({ subject, level, settings, navigateHome }: GamePageProps) => {
    const questions = useMemo(() => {
        const filtered = ALL_QUESTIONS.filter(q => q.subject === subject && q.level === level);
        return shuffleArray(filtered);
    }, [subject, level]);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [isDragOver, setIsDragOver] = useState(false);
    const [feedback, setFeedback] = useState<{correct: boolean, show: boolean} | null>(null);
    const [showHint, setShowHint] = useState(false);
    const hintTimeoutRef = useRef<number | null>(null);
    const isMounted = useRef(true);

    const [illustrationUrl, setIllustrationUrl] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    const speak = useSpeech(settings);
    const currentQuestion = useMemo(() => questions[currentIndex], [questions, currentIndex]);

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);
    
    useEffect(() => {
        if (currentQuestion) {
            speak(currentQuestion.prompt);

            if (settings.reduceMotion) {
                setIllustrationUrl(currentQuestion.illustration.src);
                return;
            }

            const generateIllustration = async () => {
                if (!isMounted.current) return;
                setIsGenerating(true);
                setIllustrationUrl(null);
                
                try {
                    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

                    const imagePromptTemplate =
                        currentQuestion.subject === Subject.Math
                            ? `Crie um prompt para um modelo de geração de imagem. A imagem DEVE representar VISUALMENTE os elementos da seguinte questão de matemática para crianças: "${currentQuestion.prompt}". O estilo deve ser um desenho animado, claro, simples, com cores vibrantes e contornos bem definidos. Foque em mostrar as formas geométricas (como quadrados, círculos, triângulos) e a quantidade EXATA de objetos descritos dentro ou perto delas. Por exemplo, se a questão for 'no quadrado há 2 lápis e no triângulo há 4 lápis', a imagem deve mostrar claramente um quadrado contendo 2 lápis e, ao lado, um triângulo contendo 4 lápis. A imagem não deve conter nenhum texto, números ou a resposta final. Apenas a cena do problema.`
                            : `Crie um prompt para um modelo de geração de imagem. A imagem deve ser um desenho animado, simples, colorido, vibrante e amigável para crianças que ilustra o seguinte problema de português: "${currentQuestion.prompt}". O estilo deve ser fofo e educacional. Descreva uma cena estática que capture a essência da questão.`;

                    // Step 1: Generate an image prompt from the question text
                    const imagePromptResponse = await ai.models.generateContent({
                      model: 'gemini-2.5-flash',
                      contents: imagePromptTemplate,
                       config: {
                         systemInstruction: "Você é um especialista em criar prompts concisos e eficazes para um modelo de IA de texto para imagem. O estilo da imagem deve ser um desenho animado, fofo, simples e educacional para crianças.",
                       },
                    });
                    const imagePrompt = imagePromptResponse.text;

                    // Step 2: Generate the image
                    const response = await ai.models.generateImages({
                        model: 'imagen-3.0-generate-002',
                        prompt: imagePrompt,
                        config: {
                          numberOfImages: 1,
                          outputMimeType: 'image/png',
                        },
                    });

                    const base64ImageBytes = response.generatedImages[0].image.imageBytes;
                    const imageUrl = `data:image/png;base64,${base64ImageBytes}`;
                    
                    if (isMounted.current) {
                       setIllustrationUrl(imageUrl);
                    }
                } catch (error) {
                    console.error("Failed to generate image illustration:", error);
                    if (isMounted.current) {
                      setIllustrationUrl(currentQuestion.illustration.src); // Fallback
                    }
                } finally {
                     if (isMounted.current) {
                        setIsGenerating(false);
                     }
                }
            };

            generateIllustration();
        }
    }, [currentQuestion, speak, settings.reduceMotion]);
    
    const resetAttemptState = () => {
        setIsDragOver(false);
        setFeedback(null);
        setShowHint(false);
        if (hintTimeoutRef.current) {
            clearTimeout(hintTimeoutRef.current);
        }
    };
    
    const handleDragStart = (e: DragEvent<HTMLDivElement>, value: string) => {
        e.dataTransfer.setData("text/plain", value);
    };
    
    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const droppedValue = e.dataTransfer.getData("text/plain");
        const isCorrect = droppedValue === currentQuestion.correctAnswer;
        
        if (isCorrect) {
            setScore(s => s + 1);
            setFeedback({ correct: true, show: true });
            if (navigator.vibrate) navigator.vibrate(100);
        } else {
            setFeedback({ correct: false, show: true });
            if (navigator.vibrate) navigator.vibrate([200, 50, 200]);
            hintTimeoutRef.current = window.setTimeout(() => setShowHint(true), 1000);
        }
    };

    const handleCloseFeedback = () => {
        if(feedback?.correct) {
            if (currentIndex < questions.length - 1) {
                setCurrentIndex(i => i + 1);
            } else {
                alert(`Fim de jogo! Sua pontuação: ${score + 1}/${questions.length}`);
                navigateHome();
            }
        }
        resetAttemptState();
    };

    if (!currentQuestion) {
        return <div className="text-center p-8">Carregando questões...</div>;
    }

    return (
        <div className="flex flex-col h-full p-4 md:p-8">
            <header className="flex justify-between items-center mb-4">
                <button onClick={navigateHome} className="text-gray-700 dark:text-gray-200 hover:text-black dark:hover:text-white transition"><HomeIcon /></button>
                <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-200">{subject} - Nível {level}</h2>
                <Stars count={score} total={questions.length} />
            </header>
            <ProgressBar current={currentIndex + 1} total={questions.length} />

            <main className="flex-grow flex flex-col items-center justify-around gap-8">
                <div className="text-center bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md w-full max-w-4xl">
                    <p className="text-2xl md:text-3xl font-semibold text-gray-800 dark:text-gray-100">{currentQuestion.prompt}</p>
                </div>
                
                 <div className="w-full max-w-lg h-56 md:h-72 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-2xl shadow-lg my-4 overflow-hidden">
                    {isGenerating ? (
                        <div className="text-center p-4">
                            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto"></div>
                            <p className="mt-4 text-xl text-gray-600 dark:text-gray-300">Gerando ilustração...</p>
                        </div>
                    ) : (
                        <img
                            src={illustrationUrl || currentQuestion.illustration.src}
                            alt={currentQuestion.illustration.alt}
                            className="w-full h-full object-cover"
                        />
                    )}
                </div>

                <div 
                    onDragEnter={() => setIsDragOver(true)} 
                    onDragLeave={() => setIsDragOver(false)} 
                    onDrop={handleDrop}
                    className="w-full flex flex-col items-center gap-6"
                >
                    <DropZone onDrop={handleDrop} isOver={isDragOver} isCorrect={feedback ? feedback.correct : null} />
                    {showHint && <p className="text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-gray-700 p-3 rounded-lg text-lg animate-fade-in">{currentQuestion.hint}</p>}
                </div>
            </main>

            <footer className="mt-auto flex justify-center items-center gap-4 md:gap-8 flex-wrap p-4">
                {currentQuestion.options.map((opt) => (
                    <DraggableItem key={opt.value} option={opt} onDragStart={handleDragStart} />
                ))}
            </footer>
            
            <FeedbackModal 
                isOpen={feedback?.show || false} 
                isCorrect={feedback?.correct || false}
                onClose={handleCloseFeedback}
                media={currentQuestion.celebrationMedia}
                settings={settings}
            />
        </div>
    );
};

// --- MAIN APP ---

const App = () => {
    const [page, setPage] = useState<Page>(Page.Home);
    const [subject, setSubject] = useState<Subject | null>(null);
    const [level, setLevel] = useState<Level | null>(null);
    const [settings, setSettings] = useLocalStorage<Settings>('apprenda-settings', {
        isTtsEnabled: false,
        isHighContrast: false,
        reduceMotion: false
    });
    
    useEffect(() => {
        const root = document.documentElement;
        if (settings.isHighContrast) {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
    }, [settings.isHighContrast]);

    const navigateTo = (newPage: Page, newSubject?: Subject) => {
        setPage(newPage);
        if (newSubject) {
            setSubject(newSubject);
        }
    };

    const navigateToGame = (newLevel: Level) => {
        setLevel(newLevel);
        setPage(Page.Game);
    };
    
    const navigateHome = () => {
        setPage(Page.Home);
        setSubject(null);
        setLevel(null);
    };

    const renderPage = () => {
        switch (page) {
            case Page.Settings:
                return <SettingsPage settings={settings} setSettings={setSettings} navigateBack={navigateHome} />;
            case Page.LevelSelection:
                if (subject) {
                    return <LevelSelectionPage subject={subject} navigateToGame={navigateToGame} navigateBack={navigateHome}/>;
                }
                return <HomePage navigateTo={navigateTo} />; // Fallback
            case Page.Game:
                if (subject && level) {
                    return <GamePage subject={subject} level={level} settings={settings} navigateHome={navigateHome}/>;
                }
                return <HomePage navigateTo={navigateTo} />; // Fallback
            case Page.Home:
            default:
                return <HomePage navigateTo={navigateTo} />;
        }
    };
    
    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-900 transition-colors duration-300">
            {page !== Page.Game && page !== Page.LevelSelection && (
                 <button onClick={() => navigateTo(Page.Settings)} className="absolute top-4 right-4 text-gray-600 dark:text-gray-300 p-2 bg-white/50 dark:bg-gray-800/50 rounded-full hover:scale-110 transition-transform">
                    <SettingsIcon />
                 </button>
            )}
            <div className="h-screen w-screen">
                {renderPage()}
            </div>
        </div>
    );
};

export default App;