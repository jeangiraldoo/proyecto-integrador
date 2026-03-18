import { createPortal } from "react-dom";
import { Trash2, Loader2, Check, X } from "lucide-react";
import ConflictModal from "@/components/modals/ConflictModal";
import { SubjectFormModal } from "@/components/views/OrganizationView";
import { type ConflictModalItem } from "@/components/modals/ConflictModal";
import { type ConflictModalSubtask } from "@/components/modals/ConflictModal";

interface LayoutModalsProps {
	isDark: boolean;
	confirmDelete: { id: number; title: string } | null;
	setConfirmDelete: (val: null) => void;
	performDeleteActivity: (id: number) => void;
	deleting: boolean;
	capacityEditorOpen: boolean;
	capacityPopoverRef: React.RefObject<HTMLDivElement | null>;
	capacityPopoverPosition: { top: number; left: number; side: "right" | "left" };
	dailyLimitDraft: string;
	setDailyLimitDraft: (val: string) => void;
	dailyLimitSaving: boolean;
	dailyLimitInputRef: React.RefObject<HTMLInputElement | null>;
	handleCapacityLimitSave: () => void;
	closeCapacityEditor: () => void;
	conflictsOpen: boolean;
	conflictModalItems: ConflictModalItem[];
	dateLoadMap: Record<string, number>;
	maxDailyHours: number;
	setConflictsOpen: (open: boolean) => void;
	handleConflictDateResolve: (data: { subtask: ConflictModalSubtask; nextDate: string }) => Promise<void>;
	handleConflictHoursResolve: (data: { subtask: ConflictModalSubtask; nextHours: number }) => Promise<void>;
	subjectModal: { mode: "add" | "rename"; current?: string } | null;
	setSubjectModal: (val: null) => void;
	addCustomSubject: (name: string) => void;
}

export default function LayoutModals({
	isDark,
	confirmDelete,
	setConfirmDelete,
	performDeleteActivity,
	deleting,
	capacityEditorOpen,
	capacityPopoverRef,
	capacityPopoverPosition,
	dailyLimitDraft,
	setDailyLimitDraft,
	dailyLimitSaving,
	dailyLimitInputRef,
	handleCapacityLimitSave,
	closeCapacityEditor,
	conflictsOpen,
	conflictModalItems,
	dateLoadMap,
	maxDailyHours,
	setConflictsOpen,
	handleConflictDateResolve,
	handleConflictHoursResolve,
	subjectModal,
	setSubjectModal,
	addCustomSubject,
}: LayoutModalsProps) {
	return (
		<>
			{confirmDelete &&
				createPortal(
					<>
						<div
							onClick={() => setConfirmDelete(null)}
							style={{
								position: "fixed",
								inset: 0,
								background: "rgba(4,3,12,0.72)",
								backdropFilter: "blur(14px) saturate(150%)",
								WebkitBackdropFilter: "blur(14px) saturate(150%)",
								zIndex: 9999,
								animation: "fadeInBackdrop 0.18s ease",
							}}
						/>
						<div
							style={{
								position: "fixed",
								inset: 0,
								zIndex: 10000,
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								padding: "20px",
							}}
						>
							<div
								onClick={(e) => e.stopPropagation()}
								style={{
									position: "relative",
									background: isDark
										? "linear-gradient(155deg,#1a0e0e 0%,#110909 55%,#090404 100%)"
										: "linear-gradient(155deg,#fff5f5 0%,#fff0f0 55%,#ffe8e8 100%)",
									border: "1px solid rgba(248,113,113,0.2)",
									borderRadius: "16px",
									width: "100%",
									maxWidth: "360px",
									boxShadow: isDark
										? "0 25px 60px rgba(0,0,0,0.65), inset 0 0 60px rgba(239,68,68,0.03)"
										: "0 25px 60px rgba(0,0,0,0.12), inset 0 0 30px rgba(239,68,68,0.02)",
									animation: "fadeInScale 0.22s cubic-bezier(0.16,1,0.3,1)",
									textAlign: "center",
									padding: "32px 28px 24px",
								}}
							>
								<div
									className="modal-glow-line"
									style={{
										background:
											"linear-gradient(90deg, transparent, rgba(239,68,68,0.5) 28%, rgba(248,113,113,0.3) 62%, transparent)",
									}}
								/>
								<div
									style={{
										width: "56px",
										height: "56px",
										borderRadius: "50%",
										background: "rgba(248,113,113,0.12)",
										border: "1px solid rgba(248,113,113,0.25)",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										margin: "0 auto 20px",
									}}
								>
									<Trash2 size={22} color="#f87171" />
								</div>
								<p
									style={{
										margin: "0 0 8px",
										fontSize: "17px",
										fontWeight: 700,
										color: isDark ? "#f1f5f9" : "#1e1a33",
									}}
								>
									Confirmar eliminación
								</p>
								<p
									style={{
										margin: "0 0 24px",
										fontSize: "13px",
										color: isDark ? "#94a3b8" : "#6b52b5",
										lineHeight: 1.6,
									}}
								>
									Se eliminará permanentemente{" "}
									<strong style={{ color: isDark ? "#e2e8f0" : "#1e1a33" }}>
										"{confirmDelete.title}"
									</strong>
									. Esta acción no se puede deshacer.
								</p>
								<div style={{ display: "flex", gap: "10px" }}>
									<button
										onClick={() => performDeleteActivity(confirmDelete.id)}
										disabled={deleting}
										className="modal-btn-danger"
										style={{
											flex: 1,
											padding: "11px 14px",
											borderRadius: "8px",
											border: "none",
											cursor: deleting ? "wait" : "pointer",
											fontSize: "13px",
											fontWeight: 700,
											background: "#ef4444",
											color: "#fff",
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											gap: "7px",
											opacity: deleting ? 0.7 : 1,
										}}
									>
										{deleting ? <Loader2 size={13} className="spinner" /> : <Trash2 size={13} />}
										{deleting ? "Eliminando..." : "Sí, eliminar"}
									</button>
									<button
										onClick={() => setConfirmDelete(null)}
										disabled={deleting}
										className="modal-btn-cancel"
										style={{
											flex: 1,
											padding: "11px 14px",
											borderRadius: "8px",
											border: isDark ? "1px solid #334155" : "1px solid rgba(239,68,68,0.3)",
											cursor: "pointer",
											fontSize: "13px",
											fontWeight: 600,
											background: "transparent",
											color: isDark ? "#94a3b8" : "#9a3a3a",
										}}
									>
										Cancelar
									</button>
								</div>
							</div>
						</div>
					</>,
					document.body,
				)}

			{capacityEditorOpen &&
				createPortal(
					<div className="capacity-popover-layer" role="presentation">
						<div
							id="capacity-quick-editor"
							ref={capacityPopoverRef}
							className={`capacity-popover is-${capacityPopoverPosition.side}`}
							role="dialog"
							aria-modal="false"
							aria-label="Editor rapido de limite diario"
							style={{
								top: `${capacityPopoverPosition.top}px`,
								left: `${capacityPopoverPosition.left}px`,
							}}
						>
							<form
								className="capacity-inline-form"
								onSubmit={(event) => {
									event.preventDefault();
									void handleCapacityLimitSave();
								}}
							>
								<label className="capacity-inline-prefix" htmlFor="daily-hours-input-floating">
									Limite
								</label>
								<div className="capacity-inline-input-wrap">
									<input
										id="daily-hours-input-floating"
										type="number"
										min={1}
										step={1}
										className="capacity-inline-input"
										value={dailyLimitDraft}
										onChange={(event) => setDailyLimitDraft(event.target.value)}
										disabled={dailyLimitSaving}
										ref={dailyLimitInputRef}
										aria-label="Horas por dia"
									/>
									<span className="capacity-inline-unit">h</span>
								</div>
								<button
									type="submit"
									className="capacity-inline-save"
									disabled={dailyLimitSaving}
									aria-label="Guardar limite"
								>
									{dailyLimitSaving ? (
										<Loader2 size={14} className="spinner" />
									) : (
										<Check size={14} />
									)}
								</button>
								<button
									type="button"
									className="capacity-inline-cancel"
									onClick={closeCapacityEditor}
									disabled={dailyLimitSaving}
									aria-label="Cancelar"
								>
									<X size={14} />
								</button>
							</form>
						</div>
					</div>,
					document.body,
				)}

			{conflictsOpen && conflictModalItems.length > 0 && (
				<ConflictModal
					conflicts={conflictModalItems}
					dateLoadMap={dateLoadMap}
					maxDailyHours={maxDailyHours}
					onClose={() => setConflictsOpen(false)}
					onChangeDate={handleConflictDateResolve}
					onReduceHours={handleConflictHoursResolve}
				/>
			)}

			{subjectModal &&
				createPortal(
					<div
						style={{
							position: "fixed",
							inset: 0,
							background: "rgba(4,3,12,0.72)",
							backdropFilter: "blur(14px) saturate(150%)",
							WebkitBackdropFilter: "blur(14px) saturate(150%)",
							zIndex: 9998,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
						onClick={() => setSubjectModal(null)}
					>
						<SubjectFormModal
							mode={subjectModal.mode}
							current={subjectModal.current}
							onClose={() => setSubjectModal(null)}
							onConfirm={(name) => {
								addCustomSubject(name);
								setSubjectModal(null);
							}}
						/>
					</div>,
					document.body,
				)}
		</>
	);
}
