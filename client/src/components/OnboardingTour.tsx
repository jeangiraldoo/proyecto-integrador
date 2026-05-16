import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Joyride, STATUS, type Step, type EventData } from "react-joyride";
import { useTheme } from "../hooks/useTheme";
import type { User } from "@/api/dashboard";

type OnboardingKey = keyof NonNullable<User["onboarding"]>;

const STORAGE_KEY_TO_ONBOARDING: Record<string, OnboardingKey> = {
	luma_has_seen_tour: "has_seen_tour",
	luma_has_seen_org_tour: "has_seen_org_tour",
	luma_has_seen_progress_tour: "has_seen_progress_tour",
};

const TARGET_CHECK_DELAY_MS = 250;
const MAX_TARGET_CHECK_RETRIES = 8;

/** True when the page is running under a WebDriver-based automation tool (e.g. Playwright). */
const IS_WEBDRIVER = navigator.webdriver;

function getScopedStorageKey(baseKey: string, userId?: number): string {
	return userId ? `${baseKey}_user_${userId}` : baseKey;
}

function isStepTargetReady(target: Step["target"]): boolean {
	if (typeof target !== "string") return true;
	if (target === "body") return true;
	return document.querySelector(target) !== null;
}

interface OnboardingTourProps {
	user?: User | null;
	onTourComplete?: (key: OnboardingKey) => void;
}

export default function OnboardingTour({ user, onTourComplete }: OnboardingTourProps) {
	const { isDark } = useTheme();
	const location = useLocation();
	const [run, setRun] = useState(false);
	const [steps, setSteps] = useState<Step[]>([]);
	const [currentStorageKey, setCurrentStorageKey] = useState<string | null>(null);
	const [currentOnboardingKey, setCurrentOnboardingKey] = useState<OnboardingKey | null>(null);

	useEffect(() => {
		if (IS_WEBDRIVER) return;
		let startTimerId: number | null = null;
		let retryTimerId: number | null = null;
		const path = location.pathname;
		let storageKey = "";
		let currentSteps: Step[] = [];

		if (path === "/hoy" || path === "/") {
			storageKey = "luma_has_seen_tour";
			currentSteps = [
				{
					target: "body",
					content: (
						<div>
							<h3>¡Bienvenido a Luma! ✨</h3>
							<p>
								Vamos a dar un rápido recorrido para que conozcas las herramientas principales y
								puedas organizar tu tiempo al máximo.
							</p>
						</div>
					),
					placement: "center",
					skipBeacon: true,
				},
				{
					target: '[data-testid="dashboard-nav-today"]',
					content: "Esta es tu vista principal de Hoy. Aquí verás las tareas más urgentes.",
					placement: "right",
				},
				{
					target: '[data-testid="dashboard-nav-org"]',
					content:
						"En la sección de Organización podrás gestionar tus materias, crear nuevas actividades y dividirlas en subtareas.",
					placement: "right",
				},
				{
					target: '[data-testid="dashboard-nav-progress"]',
					content:
						"En Mi progreso verás estadísticas generales y el porcentaje de avance de todas tus tareas.",
					placement: "right",
				},
				{
					target: "#tour-capacity",
					content:
						"Aquí puedes ver tu capacidad diaria. Define cuántas horas quieres estudiar por día y Luma te ayudará a no sobrepasarlo.",
					placement: "right",
				},
				{
					target: "#tour-conflicts",
					content:
						"Si programas más horas de tu límite, te avisaremos aquí. Haz clic para resolver los conflictos y balancear tu carga.",
					placement: "right",
				},
				{
					target: "#tour-theme",
					content:
						"Puedes cambiar entre modo claro y oscuro cuando lo desees para mayor comodidad.",
					placement: "right",
				},
				{
					target: "#tour-search",
					content: "Usa el buscador para encontrar rápidamente cualquier actividad pendiente.",
					placement: "bottom",
				},
			];
		} else if (path === "/organizacion") {
			storageKey = "luma_has_seen_org_tour";
			currentSteps = [
				{
					target: "#tour-org-add-subject",
					content:
						"Empieza creando materias para agrupar tus actividades. Esto mantendrá todo organizado.",
					placement: "bottom",
					skipBeacon: true,
				},
				{
					target: "#tour-org-add-activity",
					content: "Luego, usa este botón para crear actividades dentro de tus materias.",
					placement: "bottom",
				},
				{
					target: "#tour-org-filters",
					content:
						"Cuando tengas muchas actividades y materias, usa estos filtros para ordenarlas fácilmente.",
					placement: "bottom",
				},
			];
		} else if (path === "/progreso") {
			storageKey = "luma_has_seen_progress_tour";
			currentSteps = [
				{
					target: "#tour-progress-stats",
					content:
						"Aquí puedes ver el porcentaje global de todas las subtareas que has completado.",
					placement: "bottom",
					skipBeacon: true,
				},
				{
					target: "#tour-progress-list",
					content:
						"Y en esta lista verás el progreso específico de cada actividad, para saber qué tan cerca estás de terminar.",
					placement: "top",
				},
			];
		}

		if (storageKey && currentSteps.length > 0) {
			const onboardingKey = STORAGE_KEY_TO_ONBOARDING[storageKey];
			const seenViaApi = onboardingKey ? user?.onboarding?.[onboardingKey] === true : false;
			const scopedStorageKey = getScopedStorageKey(storageKey, user?.id);
			const seenViaStorage = !!localStorage.getItem(scopedStorageKey);
			if (!seenViaApi && !seenViaStorage) {
				let retries = 0;
				const tryStartTour = () => {
					const allTargetsReady = currentSteps.every((step) => isStepTargetReady(step.target));
					if (allTargetsReady) {
						setRun(true);
						return;
					}
					retries += 1;
					if (retries <= MAX_TARGET_CHECK_RETRIES) {
						retryTimerId = window.setTimeout(tryStartTour, TARGET_CHECK_DELAY_MS);
					}
				};
				startTimerId = window.setTimeout(() => {
					setSteps(currentSteps);
					setCurrentStorageKey(scopedStorageKey);
					setCurrentOnboardingKey(onboardingKey ?? null);
					tryStartTour();
				}, TARGET_CHECK_DELAY_MS);
			} else {
				startTimerId = window.setTimeout(() => {
					setRun(false);
					setCurrentStorageKey(null);
					setCurrentOnboardingKey(null);
				}, 0);
			}
		} else {
			startTimerId = window.setTimeout(() => {
				setRun(false);
				setCurrentStorageKey(null);
				setCurrentOnboardingKey(null);
			}, 0);
		}

		return () => {
			if (startTimerId !== null) window.clearTimeout(startTimerId);
			if (retryTimerId !== null) window.clearTimeout(retryTimerId);
		};
	}, [location.pathname, user]);

	const handleJoyrideCallback = (data: EventData) => {
		const { status } = data;
		const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

		if (finishedStatuses.includes(status)) {
			setRun(false);
			if (currentStorageKey) {
				localStorage.setItem(currentStorageKey, "true");
			}
			if (currentOnboardingKey) {
				onTourComplete?.(currentOnboardingKey);
			}
		}
	};

	if (IS_WEBDRIVER) return null;

	return (
		<Joyride
			onEvent={handleJoyrideCallback}
			continuous
			run={run}
			scrollToFirstStep
			steps={steps}
			options={{
				arrowColor: isDark ? "#1f1c2e" : "#ffffff",
				backgroundColor: isDark ? "#1f1c2e" : "#ffffff",
				overlayColor: "rgba(0, 0, 0, 0.6)",
				primaryColor: "#ef4444", // Luma's red
				textColor: isDark ? "#f1f5f9" : "#1e1a33",
				zIndex: 10000,
			}}
			styles={{
				tooltipContainer: {
					textAlign: "left",
				},
				buttonPrimary: {
					backgroundColor: "#ef4444",
					borderRadius: "6px",
					fontWeight: 600,
					padding: "8px 16px",
				},
				buttonBack: {
					color: isDark ? "#94a3b8" : "#64748b",
					marginRight: "10px",
				},
				buttonSkip: {
					color: isDark ? "#94a3b8" : "#64748b",
				},
			}}
			locale={{
				back: "Anterior",
				close: "Cerrar",
				last: "Finalizar",
				next: "Siguiente",
				skip: "Omitir",
			}}
		/>
	);
}
