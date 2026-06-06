"use client";

import { GRAMMAR_UNITS } from "@/lib/questions";
import { cn } from "@/lib/utils";

type Props = {
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function UnitSelector({ selectedId, onSelect }: Props) {
  return (
    <div>
      <h2 className="text-lg font-bold text-gray-800 mb-3">
        📚 単元を選んでください
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {GRAMMAR_UNITS.map((unit) => (
          <button
            key={unit.id}
            onClick={() => onSelect(unit.id)}
            className={cn(
              "text-left p-4 rounded-xl border-2 transition-all duration-200",
              selectedId === unit.id
                ? "border-indigo-500 bg-indigo-50 shadow-md"
                : "border-gray-200 bg-white hover:border-indigo-300 hover:shadow-sm"
            )}
          >
            <div className="font-bold text-gray-900">{unit.name}</div>
            <div className="text-sm text-gray-500 mt-1">{unit.description}</div>
            <div className="text-xs text-indigo-400 mt-2">
              {unit.questions.length}問
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
