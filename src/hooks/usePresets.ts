import { useState, useEffect } from "react";
import { load } from "@tauri-apps/plugin-store";
import { Preset, SoundType } from "../types";
import { DEFAULT_PRESETS, PRESETS_FILE } from "../constants";

export function usePresets() {
  const [presets, setPresets] = useState<Preset[]>(DEFAULT_PRESETS);
  const [enableSound, setEnableSound] = useState(true);
  const [selectedSoundType, setSelectedSoundType] = useState<SoundType>("standard");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initStore = async () => {
        try {
            const store = await load(PRESETS_FILE);
            const savedPresets = await store.get<Preset[]>("presets");
            if (savedPresets) {
                setPresets(savedPresets);
            } else {
                await store.set("presets", DEFAULT_PRESETS);
                await store.save();
            }
            
            const savedEnableSound = await store.get<boolean>("enableSound");
            if (savedEnableSound !== null && savedEnableSound !== undefined) {
                setEnableSound(savedEnableSound);
            }

            const savedSoundType = await store.get<SoundType>("selectedSoundType");
            if (savedSoundType) {
                setSelectedSoundType(savedSoundType);
            }
        } catch (e) {
            console.error("Failed to load presets/settings from store", e);
        } finally {
            setLoading(false);
        }
    };
    initStore();
  }, []);

  const savePresets = async (newPresets: Preset[]) => {
      setPresets(newPresets);
      try {
          const store = await load(PRESETS_FILE);
          await store.set("presets", newPresets);
          await store.save();
      } catch (e) {
          console.error("Failed to save presets", e);
          throw e;
      }
  };

  const saveEnableSound = async (enabled: boolean) => {
      setEnableSound(enabled);
      try {
          const store = await load(PRESETS_FILE);
          await store.set("enableSound", enabled);
          await store.save();
      } catch (e) {
          console.error("Failed to save sound setting", e);
          throw e;
      }
  };

  const saveSelectedSoundType = async (soundType: SoundType) => {
      setSelectedSoundType(soundType);
      try {
          const store = await load(PRESETS_FILE);
          await store.set("selectedSoundType", soundType);
          await store.save();
      } catch (e) {
          console.error("Failed to save sound type", e);
          throw e;
      }
  };

  return {
      presets,
      enableSound,
      selectedSoundType,
      loading,
      savePresets,
      saveEnableSound,
      saveSelectedSoundType
  };
}
