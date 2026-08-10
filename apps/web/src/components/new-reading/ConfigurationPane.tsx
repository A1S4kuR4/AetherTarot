import type { AgentProfile, DrawSource } from "@aethertarot/shared-types";
import { cn } from "@/lib/utils";
import { RitualStartButton } from "./RitualStartButton";
import type {
  AgentProfileOption,
  DrawSourceOption,
  SpreadCatalogueProps,
} from "./types";

function SpreadDiagram({ count, isSelected }: { count: number; isSelected: boolean }) {
  return (
    <span aria-hidden="true" className="new-reading-spread-diagram">
      {Array.from({ length: count }).map((_, index) => (
        <i key={index} className={cn("new-reading-spread-diagram-card", isSelected && "new-reading-spread-diagram-card-selected")} />
      ))}
    </span>
  );
}
function SpreadCatalogue({ spreads, selectedSpread, onSelect }: SpreadCatalogueProps) {
  return (
    <div className="new-reading-catalogue" role="group" aria-label="选择牌阵">
      {spreads.map((spread, index) => {
        const isSelected = selectedSpread?.id === spread.id;

        return (
          <button
            key={spread.id}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(spread)}
            className={cn("new-reading-catalogue-item", isSelected && "new-reading-catalogue-item-selected")}
          >
            <span className="min-w-0">
              <span className="new-reading-catalogue-title">
                <span className="new-reading-catalogue-index">{String(index + 1).padStart(2, "0")}</span>
                <span>{spread.name}</span>
              </span>
              <span className="new-reading-catalogue-description">{spread.description}</span>
            </span>
            <SpreadDiagram count={spread.positions.length} isSelected={isSelected} />
          </button>
        );
      })}
    </div>
  );
}

interface ChoiceCatalogueProps<T extends string> {
  ariaLabel: string;
  options: Array<AgentProfileOption | DrawSourceOption>;
  selectedValue: T;
  onSelect: (value: T) => void;
}

function ChoiceCatalogue<T extends string>({
  ariaLabel,
  options,
  selectedValue,
  onSelect,
}: ChoiceCatalogueProps<T>) {
  return (
    <div className="new-reading-catalogue-grid-3" role="group" aria-label={ariaLabel}>
      {options.map((option, index) => {
        const isSelected = selectedValue === option.id;

        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(option.id as T)}
            className={cn("new-reading-catalogue-item-compact", isSelected && "new-reading-catalogue-item-selected")}
          >
            <span className="min-w-0">
              <span className="new-reading-catalogue-title">
                <span className="new-reading-catalogue-index">{String(index + 1).padStart(2, "0")}</span>
                <span>{option.name}</span>
                {"badge" in option && option.badge ? (
                  <span className="new-reading-catalogue-badge">{option.badge}</span>
                ) : null}
              </span>
              {"subtitle" in option && option.subtitle ? (
                <span className="new-reading-catalogue-description">{option.subtitle}</span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

interface DrawSourceSegmentedControlProps {
  drawSource: DrawSource;
  drawSources: DrawSourceOption[];
  onSelect: (source: DrawSource) => void;
}

function DrawSourceSegmentedControl({
  drawSource,
  drawSources,
  onSelect,
}: DrawSourceSegmentedControlProps) {
  const selectedSource = drawSources.find((source) => source.id === drawSource);

  return (
    <div>
      <div className="new-reading-source-toggle" role="group" aria-label="选择抽牌方式">
        {drawSources.map((source) => {
          const isSelected = drawSource === source.id;

          return (
            <button
              key={source.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(source.id)}
              className={cn("new-reading-source-button", isSelected && "new-reading-source-button-selected")}
            >
              {source.name}
            </button>
          );
        })}
      </div>
      <div className="new-reading-note-slot-fixed">
        <p className="new-reading-setting-note" aria-live="polite">
          {selectedSource?.description}
        </p>
      </div>
    </div>
  );
}

interface ConfigurationPaneProps extends SpreadCatalogueProps {
  agentProfile: AgentProfile;
  agentProfiles: AgentProfileOption[];
  anonymousDailyReadingLimit: number;
  drawSource: DrawSource;
  drawSources: DrawSourceOption[];
  isNavigationPending: boolean;
  onAgentProfileSelect: (profile: AgentProfile) => void;
  onDrawSourceSelect: (source: DrawSource) => void;
  onStart: (button: HTMLButtonElement) => void;
  onQuickStart: (button: HTMLButtonElement) => void;
  quickButtonLabel: string;
  quickButtonDisabled: boolean;
  startButtonDisabled: boolean;
  startButtonLabel: string;
}

export function ConfigurationPane({
  agentProfile,
  agentProfiles,
  anonymousDailyReadingLimit,
  drawSource,
  drawSources,
  isNavigationPending,
  onAgentProfileSelect,
  onDrawSourceSelect,
  onStart,
  onQuickStart,
  quickButtonDisabled,
  quickButtonLabel,
  selectedSpread,
  spreads,
  onSelect,
  startButtonDisabled,
  startButtonLabel,
}: ConfigurationPaneProps) {
  return (
    <section aria-label="解读设置" className="new-reading-settings">
      <section aria-labelledby="new-reading-spread-title" className="new-reading-setting-section">
        <h3 id="new-reading-spread-title">I. 选择牌阵</h3>
        <SpreadCatalogue
          spreads={spreads}
          selectedSpread={selectedSpread}
          onSelect={onSelect}
        />
      </section>

      <section aria-labelledby="new-reading-profile-title" className="new-reading-setting-section">
        <h3 id="new-reading-profile-title">II. 塔罗师风格</h3>
        <ChoiceCatalogue
          ariaLabel="选择塔罗师风格"
          options={agentProfiles}
          selectedValue={agentProfile}
          onSelect={onAgentProfileSelect}
        />
      </section>

      <section aria-labelledby="new-reading-draw-title" className="new-reading-setting-section">
        <h3 id="new-reading-draw-title">III. 洗牌与抽牌</h3>
        <DrawSourceSegmentedControl
          drawSource={drawSource}
          drawSources={drawSources}
          onSelect={onDrawSourceSelect}
        />
      </section>

      <div className="new-reading-actions" data-testid="new-reading-actions">
        <RitualStartButton
          disabled={startButtonDisabled}
          label={startButtonLabel}
          onComplete={onStart}
        />
        <div className="new-reading-quick-group">
          <button
            type="button"
            onClick={(event) => {
              event.currentTarget.focus({ preventScroll: true });
              onQuickStart(event.currentTarget);
            }}
            disabled={quickButtonDisabled || isNavigationPending}
            className="new-reading-quick-button"
          >
            {quickButtonLabel}
          </button>
          <p className="new-reading-quick-help">不用写问题，30 秒看当下状态</p>
        </div>
      </div>
      <p className="new-reading-quota-note">
        免费内测 · 游客每日可完成 {anonymousDailyReadingLimit} 次完整解读；追问整合不重复计次
      </p>
    </section>
  );
}
