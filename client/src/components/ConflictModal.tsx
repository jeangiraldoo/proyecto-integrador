import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
	AlertTriangle,
	CalendarClock,
	ChevronDown,
	ChevronUp,
	Hourglass,
	Loader2,
	X,
} from "lucide-react";
import "./ConflictModal.css";

export interface ConflictInfo {
	activityTitle: string;
	date: string;
	totalHours: number;
	maxHours: number;
}

export interface ConflictModalSubtask {
	id: number;
	activityId?: number;
	name: string;
	activityTitle: string;
	estimatedHours: number;
	targetDate?: string;
	courseName?: string;
}

export interface ConflictModalItem {
	id: number;
	date: string;
	plannedHours: number;
	maxHours: number;
	title: string;
	subtitle: string;
	subtasks: ConflictModalSubtask[];
}

interface ConflictModalProps {
	conflicts: ConflictModalItem[];
	onClose: () => void;
	dateLoadMap?: Record<string, number>;
	maxDailyHours?: number;
	onChangeDate?: (payload: {
		conflict: ConflictModalItem;
		subtask: ConflictModalSubtask;
		nextDate: string;
	}) => Promise<void> | void;
	onReduceHours?: (payload: {
		conflict: ConflictModalItem;
		subtask: ConflictModalSubtask;
		nextHours: number;
	}) => Promise<void> | void;
}

type ResolverState = {
	mode: "date" | "hours";
	conflict: ConflictModalItem;
	subtask: ConflictModalSubtask;
	value: string;
};

function parseDate(date: string): Date | null {
	const parsed = new Date(`${date}T00:00:00`);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toIsoDate(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
	const next = new Date(date);
	next.setDate(next.getDate() + days);
	return next;
}

function getNextConflictFreeDate(startDate: string, conflictDates: string[]): string | null {
	const from = parseDate(startDate) ?? new Date();
	const blocked = new Set(conflictDates);

	for (let offset = 0; offset <= 90; offset += 1) {
		const candidate = toIsoDate(addDays(from, offset));
		if (!blocked.has(candidate)) return candidate;
	}

	return null;
}

function getNextCapacitySafeDate(params: {
	startDate: string;
	currentDate: string;
	movingHours: number;
	dateLoadMap: Record<string, number>;
	maxDailyHours: number;
}): string | null {
	const { startDate, currentDate, movingHours, dateLoadMap, maxDailyHours } = params;
	if (!Number.isFinite(maxDailyHours) || maxDailyHours <= 0) return null;

	const from = parseDate(startDate) ?? new Date();
	const safeMovingHours = Math.max(0, movingHours || 0);

	for (let offset = 0; offset <= 120; offset += 1) {
		const candidate = toIsoDate(addDays(from, offset));
		let candidateLoad = dateLoadMap[candidate] ?? 0;

		if (candidate === currentDate) {
			candidateLoad = Math.max(0, candidateLoad - safeMovingHours);
		}

		if (candidateLoad + safeMovingHours <= maxDailyHours) {
			return candidate;
		}
	}

	return null;
}

function normalizeHourValue(value: number): number {
	return Math.max(0, Math.round(value * 4) / 4);
}

function formatConflictDate(date: string): string {
	const parsed = new Date(`${date}T00:00:00`);
	if (Number.isNaN(parsed.getTime())) return date;
	return new Intl.DateTimeFormat("es-ES", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	}).format(parsed);
}

export default function ConflictModal({
	conflicts,
	onClose,
	dateLoadMap = {},
	maxDailyHours = 0,
	onChangeDate,
	onReduceHours,
}: ConflictModalProps) {
	const [expandedId, setExpandedId] = useState<number | null>(conflicts[0]?.id ?? null);
	const [isClosing, setIsClosing] = useState(false);
	const [resolver, setResolver] = useState<ResolverState | null>(null);
	const [resolverSaving, setResolverSaving] = useState(false);
	const [resolverError, setResolverError] = useState<string | null>(null);
	const closeTimerRef = useRef<number | null>(null);

	useEffect(() => {
		return () => {
			if (closeTimerRef.current !== null) {
				window.clearTimeout(closeTimerRef.current);
			}
		};
	}, []);

	const requestClose = useCallback(() => {
		if (isClosing) return;
		setIsClosing(true);
		closeTimerRef.current = window.setTimeout(() => {
			onClose();
		}, 220);
	}, [isClosing, onClose]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				if (resolver) {
					setResolver(null);
					setResolverError(null);
					return;
				}
				requestClose();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [requestClose, resolver]);

	const openResolver = useCallback(
		(mode: "date" | "hours", conflict: ConflictModalItem, subtask: ConflictModalSubtask) => {
			setResolverError(null);
			setResolver({
				mode,
				conflict,
				subtask,
				value:
					mode === "date"
						? (subtask.targetDate ?? conflict.date)
						: String(subtask.estimatedHours ?? ""),
			});
		},
		[],
	);

	const saveResolver = useCallback(async () => {
		if (!resolver) return;
		setResolverError(null);

		if (resolver.mode === "date") {
			const nextDate = resolver.value.trim();
			if (!nextDate) {
				setResolverError("Selecciona una fecha valida.");
				return;
			}

			if (!onChangeDate) {
				requestClose();
				return;
			}

			try {
				setResolverSaving(true);
				await onChangeDate({
					conflict: resolver.conflict,
					subtask: resolver.subtask,
					nextDate,
				});
				setResolver(null);
			} catch {
				setResolverError("No se pudo actualizar la fecha. Intenta de nuevo.");
			} finally {
				setResolverSaving(false);
			}
			return;
		}

		const parsed = Number(resolver.value);
		if (!Number.isFinite(parsed) || parsed < 0) {
			setResolverError("Ingresa horas validas (0 o mas).");
			return;
		}

		if (!onReduceHours) {
			requestClose();
			return;
		}

		try {
			setResolverSaving(true);
			await onReduceHours({
				conflict: resolver.conflict,
				subtask: resolver.subtask,
				nextHours: parsed,
			});
			setResolver(null);
		} catch {
			setResolverError("No se pudieron actualizar las horas. Intenta de nuevo.");
		} finally {
			setResolverSaving(false);
		}
	}, [onChangeDate, onReduceHours, requestClose, resolver]);

	const suggestedDateCandidate =
		resolver?.mode === "date"
			? (getNextCapacitySafeDate({
					startDate: resolver.value || resolver.conflict.date,
					currentDate: resolver.subtask.targetDate ?? resolver.conflict.date,
					movingHours: resolver.subtask.estimatedHours,
					dateLoadMap,
					maxDailyHours,
				}) ??
				getNextConflictFreeDate(
					resolver.value || resolver.conflict.date,
					conflicts.map((item) => item.date),
				))
			: null;

	const suggestedDate =
		resolver?.mode === "date" && suggestedDateCandidate && suggestedDateCandidate !== resolver.value
			? suggestedDateCandidate
			: null;

	const suggestedHours =
		resolver?.mode === "hours"
			? normalizeHourValue(
					resolver.subtask.estimatedHours -
						Math.max(resolver.conflict.plannedHours - resolver.conflict.maxHours, 0),
				)
			: null;

	const suggestedHoursLabel =
		typeof suggestedHours === "number"
			? Number.isInteger(suggestedHours)
				? String(suggestedHours)
				: suggestedHours.toFixed(2).replace(/\.00$/, "").replace(/0$/, "")
			: "";

	if (!conflicts.length) return null;

	return createPortal(
		<div className={`cf-layer ${isClosing ? "is-closing" : ""}`} aria-live="polite">
			<div className="cf-backdrop" onClick={requestClose} />
			<section
				className="cf-modal"
				role="dialog"
				aria-modal="true"
				aria-labelledby="cf-modal-title"
				onClick={(event) => event.stopPropagation()}
			>
				<button className="cf-close" onClick={requestClose} aria-label="Cerrar modal de conflictos">
					<X size={16} />
				</button>

				<header className="cf-header">
					<div className="cf-header-left">
						<div className="cf-header-icon" aria-hidden="true">
							<AlertTriangle size={22} />
						</div>
						<div className="cf-header-text">
							<h2 id="cf-modal-title">Conflictos detectados</h2>
							<p>
								Se detectaron sobrecargas de horas en multiples actividades. Revisa cada conflicto
								antes de continuar.
							</p>
						</div>
					</div>
				</header>

				<div className="cf-content">
					{conflicts.map((conflict) => {
						const isExpanded = expandedId === conflict.id;

						return (
							<article key={conflict.id} className={`cf-item ${isExpanded ? "is-expanded" : ""}`}>
								<div className="cf-item-summary">
									<div className="cf-title-wrap">
										<h3>{conflict.title}</h3>
										<p>{conflict.subtitle}</p>
									</div>

									<div className="cf-meta-block">
										<span className="cf-meta-label">Fecha</span>
										<span className="cf-meta-value">{formatConflictDate(conflict.date)}</span>
									</div>

									<div className="cf-meta-block">
										<span className="cf-meta-label">Carga ese dia</span>
										<span className="cf-hours-value">
											{conflict.plannedHours}h / {conflict.maxHours}h max
										</span>
									</div>

									<button
										type="button"
										className="cf-toggle"
										onClick={() => setExpandedId(isExpanded ? null : conflict.id)}
									>
										{isExpanded ? "Ocultar" : "Resolver"}
										{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
									</button>
								</div>

								<div
									className={`cf-item-details-shell ${isExpanded ? "is-open" : ""}`}
									aria-hidden={!isExpanded}
								>
									<div className="cf-item-details">
										<div className="cf-detail-head">
											<CalendarClock size={14} />
											<span>Resuelve por subtarea</span>
										</div>

										{conflict.subtasks.length ? (
											<div className="cf-subtasks">
												{conflict.subtasks.map((subtask) => (
													<div key={subtask.id} className="cf-subtask-row">
														<div className="cf-subtask-main">
															<div className="cf-subtask-name">{subtask.name}</div>
															<div className="cf-subtask-meta">
																{subtask.activityTitle}
																{subtask.courseName ? ` · ${subtask.courseName}` : ""}
															</div>
														</div>
														<div className="cf-subtask-hours">
															<Hourglass size={14} />
															{subtask.estimatedHours}h
														</div>
														<div className="cf-subtask-actions">
															<button
																type="button"
																className="cf-solution-btn is-primary"
																onClick={() => {
																	openResolver("date", conflict, subtask);
																}}
															>
																<span>Cambiar fecha</span>
															</button>
															<button
																type="button"
																className="cf-solution-btn"
																onClick={() => {
																	openResolver("hours", conflict, subtask);
																}}
															>
																<span>Reducir horas</span>
															</button>
														</div>
													</div>
												))}
											</div>
										) : (
											<div className="cf-empty-detail">
												No se encontraron subtareas detalladas para esta fecha, pero el backend
												reporta una sobrecarga activa.
											</div>
										)}

										<button type="button" className="cf-link" onClick={() => setExpandedId(null)}>
											Ver despues
										</button>
									</div>
								</div>
							</article>
						);
					})}
				</div>

				<footer className="cf-footer">
					<div className="cf-footer-status">
						Revisa cada conflicto y aplica una solucion cuando quieras.
					</div>
				</footer>

				{resolver && (
					<div className="cf-resolver-layer" onClick={() => !resolverSaving && setResolver(null)}>
						<div className="cf-resolver-card" onClick={(event) => event.stopPropagation()}>
							<h3>
								{resolver.mode === "date"
									? "Cambiar fecha de subtarea"
									: "Reducir horas de subtarea"}
							</h3>
							<p>
								<strong>{resolver.subtask.name}</strong> · {resolver.subtask.activityTitle}
							</p>

							<label className="cf-resolver-label">
								{resolver.mode === "date" ? "Nueva fecha" : "Horas estimadas"}
							</label>
							{resolver.mode === "date" ? (
								<input
									type="date"
									className="cf-resolver-input"
									value={resolver.value}
									onChange={(event) =>
										setResolver((prev) => (prev ? { ...prev, value: event.target.value } : prev))
									}
									disabled={resolverSaving}
								/>
							) : (
								<input
									type="number"
									min="0"
									step="0.25"
									className="cf-resolver-input"
									value={resolver.value}
									onChange={(event) =>
										setResolver((prev) => (prev ? { ...prev, value: event.target.value } : prev))
									}
									disabled={resolverSaving}
								/>
							)}

							{resolver.mode === "date" && suggestedDate && (
								<div className="cf-resolver-suggestions">
									<button
										type="button"
										className="cf-resolver-chip"
										onClick={() =>
											setResolver((prev) =>
												prev && prev.mode === "date" ? { ...prev, value: suggestedDate } : prev,
											)
										}
										disabled={resolverSaving}
									>
										Sugerido: {formatConflictDate(suggestedDate)}
									</button>
								</div>
							)}

							{resolver.mode === "hours" && typeof suggestedHours === "number" && (
								<div className="cf-resolver-suggestions">
									<button
										type="button"
										className="cf-resolver-chip"
										onClick={() =>
											setResolver((prev) =>
												prev && prev.mode === "hours"
													? { ...prev, value: String(suggestedHours) }
													: prev,
											)
										}
										disabled={resolverSaving}
									>
										Sugerido: {suggestedHoursLabel}h
									</button>
								</div>
							)}

							{resolverError && <div className="cf-resolver-error">{resolverError}</div>}

							<div className="cf-resolver-actions">
								<button
									type="button"
									className="cf-resolver-btn"
									onClick={() => setResolver(null)}
									disabled={resolverSaving}
								>
									Cancelar
								</button>
								<button
									type="button"
									className="cf-resolver-btn is-confirm"
									onClick={() => void saveResolver()}
									disabled={resolverSaving}
								>
									{resolverSaving ? <Loader2 size={14} className="cf-spin" /> : null}
									Guardar
								</button>
							</div>
						</div>
					</div>
				)}
			</section>
		</div>,
		document.body,
	);
}
