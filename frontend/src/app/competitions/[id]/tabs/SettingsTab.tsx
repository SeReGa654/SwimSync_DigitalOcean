'use client';
import { Fragment, useEffect, useState } from 'react';
import {
  api,
  ProtocolCondition,
  ProtocolConditionBlock,
  ProtocolRuleGroup,
  ResultProtocolConfig,
  ResultProtocolPreset,
} from '@/lib/api';
import { Competition } from '@/types';
import { Trash2, Users, Settings, Info, Play, CheckCircle2, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface Props {
  comp: Competition;
  load: () => Promise<void>;
}

export default function SettingsTab({ comp, load }: Props) {
  const createEmptyCondition = (): ProtocolCondition => ({ field: 'region', operator: 'CONTAINS', value: '' });
  const createEmptyBlock = (): ProtocolConditionBlock => ({ operator: 'AND', conditions: [createEmptyCondition()] });
  const createEmptyGroup = (): ProtocolRuleGroup => ({ name: 'Нова група', operator: 'AND', conditions: [createEmptyCondition()], subgroups: [] });

  const [ageGroupForm, setAgeGroupForm] = useState({ name: '', birthYearFrom: 2012, birthYearTo: 2013 });
  const [competitionForm, setCompetitionForm] = useState({
    name: comp.name,
    categoriesStr: comp.categoriesStr || '',
    location: comp.location || '',
    venue: comp.venue || '',
    poolLength: comp.poolLength || 50,
    lanes: comp.lanes || 8,
    dateFrom: comp.dateFrom || '',
    dateTo: comp.dateTo || '',
  });
  const [protocolFormat, setProtocolFormat] = useState<'SEPARATE' | 'COMBINED' | 'MIXED'>(
    comp.resultProtocolFormat || 'SEPARATE'
  );
  const [mixedPrimaryAgeGroupId, setMixedPrimaryAgeGroupId] = useState<number | null>(
    comp.mixedFormatPrimaryAgeGroupId || null
  );
  const [mixedSecondaryAgeGroupIds, setMixedSecondaryAgeGroupIds] = useState<number[]>(
    comp.mixedFormatSecondaryAgeGroupIds ? JSON.parse(comp.mixedFormatSecondaryAgeGroupIds) : []
  );
  const [advancedGroupingEnabled, setAdvancedGroupingEnabled] = useState(false);
  const [advancedGroups, setAdvancedGroups] = useState<ProtocolRuleGroup[]>([]);
  const [includeUnmatched, setIncludeUnmatched] = useState(true);
  const [unmatchedGroupName, setUnmatchedGroupName] = useState('Інші');
  const [presets, setPresets] = useState<ResultProtocolPreset[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetShared, setNewPresetShared] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<number | null>(null);
  const [editingPresetName, setEditingPresetName] = useState('');
  const [editingPresetShared, setEditingPresetShared] = useState(false);
  const [myDefaults, setMyDefaults] = useState<ResultProtocolConfig | null>(null);
  const [authRole, setAuthRole] = useState<'admin' | 'secretary' | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<'complete' | 'draft' | 'delete' | null>(null);

  const isAdmin = authRole === 'admin';
  const canManageProtocol = authRole === 'admin' || authRole === 'secretary';

  useEffect(() => {
    setCompetitionForm({
      name: comp.name,
      categoriesStr: comp.categoriesStr || '',
      location: comp.location || '',
      venue: comp.venue || '',
      poolLength: comp.poolLength || 50,
      lanes: comp.lanes || 8,
      dateFrom: comp.dateFrom || '',
      dateTo: comp.dateTo || '',
    });
    setProtocolFormat(comp.resultProtocolFormat || 'SEPARATE');
    setMixedPrimaryAgeGroupId(comp.mixedFormatPrimaryAgeGroupId || null);
    setMixedSecondaryAgeGroupIds(
      comp.mixedFormatSecondaryAgeGroupIds ? JSON.parse(comp.mixedFormatSecondaryAgeGroupIds) : []
    );
    void api.getResultProtocolConfig(comp.id).then((cfg) => {
      setProtocolFormat(cfg.format || 'SEPARATE');
      setMixedPrimaryAgeGroupId(cfg.mixedFormatPrimaryAgeGroupId || null);
      setMixedSecondaryAgeGroupIds(cfg.mixedFormatSecondaryAgeGroupIds || []);
      setAdvancedGroupingEnabled(Boolean(cfg.advancedGrouping?.enabled));
      setAdvancedGroups(cfg.advancedGrouping?.groups || []);
      setIncludeUnmatched(cfg.advancedGrouping?.includeUnmatched ?? true);
      setUnmatchedGroupName(cfg.advancedGrouping?.unmatchedGroupName || 'Інші');
    }).catch(() => {
      setAdvancedGroupingEnabled(false);
      setAdvancedGroups([]);
      setIncludeUnmatched(true);
      setUnmatchedGroupName('Інші');
    });
  }, [comp]);

  useEffect(() => {
    api.getAuthStatus()
      .then((status) => {
        if (!status.authenticated) {
          setAuthRole(null);
          setCurrentUserId(null);
          return;
        }
        setAuthRole(status.role || null);
        setCurrentUserId(status.userId ?? null);
      })
      .catch(() => {
        setAuthRole(null);
        setCurrentUserId(null);
      });
  }, []);

  useEffect(() => {
    setPresetsLoading(true);
    Promise.all([
      api.listResultProtocolPresets(comp.id).catch(() => []),
      api.getMyResultProtocolDefaults().catch(() => null),
    ]).then(([presetList, defaults]) => {
      setPresets(presetList);
      setMyDefaults(defaults);
    }).finally(() => setPresetsLoading(false));
  }, [comp.id]);

  const handleAddAgeGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.createAgeGroup(comp.id, ageGroupForm);
    load();
    setAgeGroupForm({ name: '', birthYearFrom: 2012, birthYearTo: 2013 });
  };

  const handleUpdateStatus = async (status: string) => {
    const loadingToast = toast.loading('Оновлення статусу...');
    try {
      await api.updateCompetition(comp.id, { status });
      await load();
      toast.success(`Статус змінено на ${
        status === 'active' ? 'Live' : 
        status === 'completed' ? 'Завершено' : 
        'Чернетка'
      }`, { id: loadingToast });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Помилка оновлення статусу', { id: loadingToast });
    }
  };

  const handleSaveCompetition = async (event: React.FormEvent) => {
    event.preventDefault();
    const loadingToast = toast.loading('Збереження параметрів...');
    try {
      await api.updateCompetition(comp.id, {
        ...competitionForm,
        dateFrom: competitionForm.dateFrom || null,
        dateTo: competitionForm.dateTo || null,
      });
      await load();
      toast.success('Параметри змагання оновлено', { id: loadingToast });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Помилка оновлення змагання', { id: loadingToast });
    }
  };

  const handleDeleteCompetition = async () => {
    const loadingToast = toast.loading('Видалення змагання...');
    try {
      await api.deleteCompetition(comp.id);
      toast.success('Змагання видалено', { id: loadingToast });
      window.location.href = '/competitions';
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Помилка видалення змагання', { id: loadingToast });
    }
  };

  const handleSaveProtocolConfig = async () => {
    if (!canManageProtocol) {
      toast.error('Налаштуваннями протоколів можуть керувати лише адміністратор або секретар.');
      return;
    }
    const loadingToast = toast.loading('Збереження налаштувань протокол...');
    try {
      if (protocolFormat === 'MIXED' && (!mixedPrimaryAgeGroupId || mixedSecondaryAgeGroupIds.length === 0)) {
        toast.error('Для змішаного формату вибери основну та допоміжні групи', { id: loadingToast });
        return;
      }
      if (advancedGroupingEnabled && advancedGroups.length === 0) {
        toast.error('Додай хоча б одну групу для розширеного групування', { id: loadingToast });
        return;
      }
      const validationErrors = getAdvancedGroupingValidationErrors();
      if (validationErrors.length > 0) {
        toast.error(validationErrors[0], { id: loadingToast });
        return;
      }
      await api.setResultProtocolConfig(comp.id, {
        format: protocolFormat,
        mixedFormatPrimaryAgeGroupId: protocolFormat === 'MIXED' ? mixedPrimaryAgeGroupId : null,
        mixedFormatSecondaryAgeGroupIds: protocolFormat === 'MIXED' ? mixedSecondaryAgeGroupIds : [],
        advancedGrouping: advancedGroupingEnabled ? {
          enabled: true,
          groups: advancedGroups,
          includeUnmatched,
          unmatchedGroupName,
        } : null,
      });
      await load();
      toast.success('Налаштування протокол збережено', { id: loadingToast });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Помилка збереження налаштувань', { id: loadingToast });
    }
  };

  const toggleSecondaryAgeGroup = (agId: number) => {
    setMixedSecondaryAgeGroupIds(prev =>
      prev.includes(agId) ? prev.filter(id => id !== agId) : [...prev, agId]
    );
  };

  const parseConditionValue = (condition: ProtocolCondition, raw: string): ProtocolCondition['value'] => {
    if (condition.operator === 'IN') {
      const values = raw.split(',').map((item) => item.trim()).filter(Boolean);
      if (condition.field === 'ageGroupId') return values.map((item) => Number(item)).filter((item) => Number.isInteger(item));
      return values;
    }
    if (condition.field === 'ageGroupId') {
      const parsed = Number(raw);
      return Number.isInteger(parsed) ? parsed : 0;
    }
    return raw;
  };

  const stringifyConditionValue = (condition: ProtocolCondition): string =>
    Array.isArray(condition.value) ? condition.value.join(',') : String(condition.value ?? '');

  const getConditionValidationMessage = (condition: ProtocolCondition): string | null => {
    if (condition.operator === 'IN') {
      if (!Array.isArray(condition.value)) return 'Для IN потрібен список значень через кому.';
      if (condition.value.length === 0) return 'Для IN вкажи хоча б одне значення.';
      if (
        condition.field === 'ageGroupId'
        && condition.value.some((item) => !Number.isInteger(Number(item)) || Number(item) <= 0)
      ) {
        return 'Для ageGroupId в IN використовуй лише цілі додатні ID.';
      }
      return null;
    }

    if (condition.field === 'ageGroupId') {
      const value = Number(condition.value);
      if (!Number.isInteger(value) || value <= 0) return 'Для ageGroupId вкажи цілий додатний ID.';
      return null;
    }

    if (typeof condition.value !== 'string' || condition.value.trim().length === 0) {
      return 'Значення умови не може бути порожнім.';
    }
    return null;
  };

  const getAdvancedGroupingValidationErrors = (): string[] => {
    if (!advancedGroupingEnabled) return [];
    const errors: string[] = [];

    if (advancedGroups.length === 0) {
      errors.push('Додай хоча б одну групу для розширеного групування.');
    }

    advancedGroups.forEach((group, groupIndex) => {
      const groupLabel = `Група #${groupIndex + 1}`;
      if (!group.name?.trim()) errors.push(`${groupLabel}: назва обов'язкова.`);
      if (!group.conditions.length) errors.push(`${groupLabel}: додай хоча б одну умову.`);

      group.conditions.forEach((condition, conditionIndex) => {
        const conditionError = getConditionValidationMessage(condition);
        if (conditionError) errors.push(`${groupLabel}, умова #${conditionIndex + 1}: ${conditionError}`);
      });

      (group.subgroups || []).forEach((subgroup, subgroupIndex) => {
        if (!subgroup.conditions.length) {
          errors.push(`${groupLabel}, підблок #${subgroupIndex + 1}: додай хоча б одну умову.`);
        }
        subgroup.conditions.forEach((condition, conditionIndex) => {
          const conditionError = getConditionValidationMessage(condition);
          if (conditionError) {
            errors.push(`${groupLabel}, підблок #${subgroupIndex + 1}, умова #${conditionIndex + 1}: ${conditionError}`);
          }
        });
      });
    });

    if (includeUnmatched && !unmatchedGroupName.trim()) {
      errors.push('Вкажи назву для групи незіставлених записів.');
    }

    return errors;
  };

  const cloneGroup = (group: ProtocolRuleGroup): ProtocolRuleGroup =>
    JSON.parse(JSON.stringify({ ...group, name: `${group.name || 'Група'} (копія)` })) as ProtocolRuleGroup;

  const cloneBlock = (block: ProtocolConditionBlock): ProtocolConditionBlock =>
    JSON.parse(JSON.stringify(block)) as ProtocolConditionBlock;

  const updateGroupCondition = (groupIndex: number, conditionIndex: number, next: ProtocolCondition) => {
    setAdvancedGroups((prev) => prev.map((group, gi) => {
      if (gi !== groupIndex) return group;
      return {
        ...group,
        conditions: group.conditions.map((condition, ci) => (ci === conditionIndex ? next : condition)),
      };
    }));
  };

  const updateSubgroupCondition = (
    groupIndex: number,
    subgroupIndex: number,
    conditionIndex: number,
    next: ProtocolCondition,
  ) => {
    setAdvancedGroups((prev) => prev.map((group, gi) => {
      if (gi !== groupIndex) return group;
      return {
        ...group,
        subgroups: (group.subgroups || []).map((subgroup, si) => {
          if (si !== subgroupIndex) return subgroup;
          return {
            ...subgroup,
            conditions: subgroup.conditions.map((condition, ci) => (ci === conditionIndex ? next : condition)),
          };
        }),
      };
    }));
  };

  const currentProtocolConfig: ResultProtocolConfig = {
    format: protocolFormat,
    mixedFormatPrimaryAgeGroupId: protocolFormat === 'MIXED' ? mixedPrimaryAgeGroupId : null,
    mixedFormatSecondaryAgeGroupIds: protocolFormat === 'MIXED' ? mixedSecondaryAgeGroupIds : [],
    advancedGrouping: advancedGroupingEnabled
      ? {
        enabled: true,
        groups: advancedGroups,
        includeUnmatched,
        unmatchedGroupName,
      }
      : null,
  };

  const canEditPreset = (preset: ResultProtocolPreset): boolean => {
    if (!canManageProtocol) return false;
    if (isAdmin) return true;
    return currentUserId !== null && preset.ownerUserId === currentUserId;
  };

  const canApplyPreset = (preset: ResultProtocolPreset): boolean => {
    if (!canManageProtocol) return false;
    if (isAdmin) return true;
    return preset.isShared || (currentUserId !== null && preset.ownerUserId === currentUserId);
  };

  const reloadPresetsAndDefaults = async () => {
    setPresetsLoading(true);
    try {
      const [presetList, defaults] = await Promise.all([
        api.listResultProtocolPresets(comp.id),
        api.getMyResultProtocolDefaults(),
      ]);
      setPresets(presetList);
      setMyDefaults(defaults);
    } finally {
      setPresetsLoading(false);
    }
  };

  const handleSaveMyDefaults = async () => {
    const loadingToast = toast.loading('Збереження дефолтів...');
    try {
      await api.setMyResultProtocolDefaults(currentProtocolConfig);
      await reloadPresetsAndDefaults();
      toast.success('Ваші дефолти оновлено', { id: loadingToast });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Не вдалося зберегти дефолти', { id: loadingToast });
    }
  };

  const handleApplyMyDefaults = async () => {
    if (!myDefaults) return;
    setProtocolFormat(myDefaults.format || 'SEPARATE');
    setMixedPrimaryAgeGroupId(myDefaults.mixedFormatPrimaryAgeGroupId || null);
    setMixedSecondaryAgeGroupIds(myDefaults.mixedFormatSecondaryAgeGroupIds || []);
    setAdvancedGroupingEnabled(Boolean(myDefaults.advancedGrouping?.enabled));
    setAdvancedGroups(myDefaults.advancedGrouping?.groups || []);
    setIncludeUnmatched(myDefaults.advancedGrouping?.includeUnmatched ?? true);
    setUnmatchedGroupName(myDefaults.advancedGrouping?.unmatchedGroupName || 'Інші');
    toast.success('Дефолти застосовано в форму');
  };

  const handleCreatePreset = async () => {
    if (!canManageProtocol) {
      toast.error('Недостатньо прав для створення пресета.');
      return;
    }
    const name = newPresetName.trim();
    if (!name) {
      toast.error('Вкажи назву пресета');
      return;
    }
    const loadingToast = toast.loading('Створення пресета...');
    try {
      await api.createResultProtocolPreset(comp.id, {
        name,
        isShared: isAdmin ? newPresetShared : false,
        config: currentProtocolConfig,
      });
      setNewPresetName('');
      setNewPresetShared(false);
      await reloadPresetsAndDefaults();
      toast.success('Пресет створено', { id: loadingToast });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Не вдалося створити пресет', { id: loadingToast });
    }
  };

  const handleApplyPreset = async (preset: ResultProtocolPreset) => {
    if (!canApplyPreset(preset)) {
      toast.error('Недостатньо прав для застосування цього пресета.');
      return;
    }
    const loadingToast = toast.loading('Застосування пресета...');
    try {
      await api.applyResultProtocolPreset(comp.id, preset.id);
      await load();
      await reloadPresetsAndDefaults();
      toast.success('Пресет застосовано', { id: loadingToast });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Не вдалося застосувати пресет', { id: loadingToast });
    }
  };

  const handleStartEditPreset = (preset: ResultProtocolPreset) => {
    if (!canEditPreset(preset)) {
      toast.error('Ви можете редагувати лише власні пресети.');
      return;
    }
    setEditingPresetId(preset.id);
    setEditingPresetName(preset.name);
    setEditingPresetShared(Boolean(preset.isShared));
  };

  const handleCancelEditPreset = () => {
    setEditingPresetId(null);
    setEditingPresetName('');
    setEditingPresetShared(false);
  };

  const handleSavePresetChanges = async (presetId: number) => {
    const preset = presets.find((item) => item.id === presetId);
    if (!preset || !canEditPreset(preset)) {
      toast.error('Ви можете редагувати лише власні пресети.');
      return;
    }
    const trimmedName = editingPresetName.trim();
    if (!trimmedName) {
      toast.error('Назва пресета обовʼязкова');
      return;
    }
    const loadingToast = toast.loading('Оновлення пресета...');
    try {
      await api.updateResultProtocolPreset(comp.id, presetId, {
        name: trimmedName,
        isShared: isAdmin ? editingPresetShared : undefined,
      });
      await reloadPresetsAndDefaults();
      handleCancelEditPreset();
      toast.success('Пресет оновлено', { id: loadingToast });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Не вдалося оновити пресет', { id: loadingToast });
    }
  };

  const handleDeletePreset = async (presetId: number) => {
    const preset = presets.find((item) => item.id === presetId);
    if (!preset || !canEditPreset(preset)) {
      toast.error('Ви можете видаляти лише власні пресети.');
      return;
    }
    const loadingToast = toast.loading('Видалення пресета...');
    try {
      await api.deleteResultProtocolPreset(comp.id, presetId);
      await reloadPresetsAndDefaults();
      toast.success('Пресет видалено', { id: loadingToast });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Не вдалося видалити пресет', { id: loadingToast });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Age Groups Section */}
      <section className="glass-card p-6 border-white/5">
        <div className="flex items-center gap-3 mb-6">
          <Users className="w-5 h-5 text-primary-400" />
          <h3 className="text-xl font-bold">Вікові групи</h3>
        </div>
        
        <form onSubmit={handleAddAgeGroup} className="space-y-4 mb-8 bg-white/5 p-4 rounded-xl border border-white/5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Назва групи</label>
            <input
              value={ageGroupForm.name}
              onChange={(e) => setAgeGroupForm({ ...ageGroupForm, name: e.target.value })}
              className="w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-primary-500 outline-none"
              placeholder="Наприклад: Група А (2012-2013)"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Рік від</label>
              <input
                type="number"
                value={ageGroupForm.birthYearFrom}
                onChange={(e) => setAgeGroupForm({ ...ageGroupForm, birthYearFrom: parseInt(e.target.value) })}
                className="w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-primary-500 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Рік до</label>
              <input
                type="number"
                value={ageGroupForm.birthYearTo}
                onChange={(e) => setAgeGroupForm({ ...ageGroupForm, birthYearTo: parseInt(e.target.value) })}
                className="w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-primary-500 outline-none"
              />
            </div>
          </div>
          <button type="submit" className="btn-primary w-full py-2 text-xs">
            Додати групу
          </button>
        </form>

        <div className="space-y-2">
          {comp.ageGroups?.map((ag) => (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              key={ag.id} 
              className="flex items-center justify-between bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl px-4 py-3 transition-colors"
            >
              <span className="font-bold text-sm text-slate-200">
                {ag.name} <span className="text-slate-500 font-medium ml-2">{ag.birthYearFrom} – {ag.birthYearTo} р.н.</span>
              </span>
              <button
                onClick={() => api.deleteAgeGroup(ag.id).then(load)}
                className="text-slate-600 hover:text-red-400 transition-colors p-1"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
          {(!comp.ageGroups || comp.ageGroups.length === 0) && (
            <div className="text-center py-8 text-slate-600 text-xs uppercase font-bold tracking-widest">
              Групи не налаштовані
            </div>
          )}
        </div>
      </section>

      {/* Info/Parameters Section */}
      <section className="space-y-8">
        <div className="glass-card p-6 border-white/5">
          <div className="flex items-center gap-3 mb-6">
            <Settings className="w-5 h-5 text-primary-400" />
            <h3 className="text-xl font-bold">Параметри змагання</h3>
          </div>
          <form onSubmit={handleSaveCompetition} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Назва</label>
              <input
                value={competitionForm.name}
                onChange={(e) => setCompetitionForm((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-primary-500 outline-none"
                required
              />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Категорії</label>
              <input
                value={competitionForm.categoriesStr}
                onChange={(e) => setCompetitionForm((prev) => ({ ...prev, categoriesStr: e.target.value }))}
                className="w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-primary-500 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Локація</label>
              <input
                value={competitionForm.location}
                onChange={(e) => setCompetitionForm((prev) => ({ ...prev, location: e.target.value }))}
                className="w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-primary-500 outline-none"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Басейн</label>
              <input
                value={competitionForm.venue}
                onChange={(e) => setCompetitionForm((prev) => ({ ...prev, venue: e.target.value }))}
                className="w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-primary-500 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Довжина басейну</label>
              <select
                value={competitionForm.poolLength}
                onChange={(e) => setCompetitionForm((prev) => ({ ...prev, poolLength: Number.parseInt(e.target.value, 10) }))}
                className="w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-primary-500 outline-none"
              >
                <option value={50}>50м</option>
                <option value={25}>25м</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Доріжки</label>
              <input
                type="number"
                min={4}
                max={10}
                value={competitionForm.lanes}
                onChange={(e) => setCompetitionForm((prev) => ({ ...prev, lanes: Number.parseInt(e.target.value, 10) || 8 }))}
                className="w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-primary-500 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Дата початку</label>
              <input
                type="date"
                value={competitionForm.dateFrom || ''}
                onChange={(e) => setCompetitionForm((prev) => ({ ...prev, dateFrom: e.target.value }))}
                className="w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-primary-500 outline-none [color-scheme:dark]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Дата завершення</label>
              <input
                type="date"
                value={competitionForm.dateTo || ''}
                onChange={(e) => setCompetitionForm((prev) => ({ ...prev, dateTo: e.target.value }))}
                className="w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-primary-500 outline-none [color-scheme:dark]"
              />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button type="submit" className="btn-primary !px-4 !py-2 text-xs">
                Зберегти параметри
              </button>
            </div>
          </form>
        </div>

        <div className="glass-card p-6 border-white/5 bg-primary-500/[0.02]">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-6">Керування станом</h3>
          <div className="flex flex-col gap-3">
            {comp.status === 'draft' && (
              <button onClick={() => handleUpdateStatus('active')}
                className="flex items-center justify-center gap-3 w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-emerald-600/20">
                <Play className="w-4 h-4 fill-current" /> Розпочати змагання
              </button>
            )}
            
            {comp.status === 'active' && (
              <button 
                onClick={() => setConfirmAction('complete')}
                className="flex items-center justify-center gap-3 w-full py-4 bg-primary-600 hover:bg-primary-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-primary-600/20">
                <CheckCircle2 className="w-4 h-4" /> Завершити та архівувати
              </button>
            )}

            {comp.status === 'completed' && (
              <button onClick={() => handleUpdateStatus('active')}
                className="flex items-center justify-center gap-3 w-full py-4 bg-white/5 hover:bg-white/10 text-slate-300 rounded-2xl font-black uppercase text-xs tracking-widest transition-all border border-white/10">
                <RotateCcw className="w-4 h-4" /> Відкрити для редагування
              </button>
            )}

            {comp.status !== 'draft' && (
              <button 
                onClick={() => setConfirmAction('draft')}
                className="text-center text-[10px] text-slate-600 hover:text-slate-400 font-bold uppercase tracking-widest mt-2 py-2 transition-colors">
                Повернути в статус чернетки
              </button>
            )}
          </div>
        </div>

        {/* Result Protocol Format Configuration */}
        <div className="glass-card p-6 border-white/5">
          <div className="flex items-center gap-3 mb-6">
            <Settings className="w-5 h-5 text-primary-400" />
            <h3 className="text-xl font-bold">Формат фінішних протоколів</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Вибери спосіб формування</label>
              <select
                value={protocolFormat}
                onChange={(e) => setProtocolFormat(e.target.value as any)}
                className="w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-primary-500 outline-none"
              >
                <option value="SEPARATE">Окремо по вікових категоріях</option>
                <option value="COMBINED">Об'єднаний рейтинг (всі категорії разом)</option>
                <option value="MIXED">Змішаний (основна група окремо + об'єднані інші)</option>
              </select>
            </div>

            {protocolFormat === 'MIXED' && (
              <div className="bg-white/5 p-4 rounded-lg border border-white/10 space-y-3">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Основна вікова група</label>
                  <select
                    value={mixedPrimaryAgeGroupId || ''}
                    onChange={(e) => setMixedPrimaryAgeGroupId(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-primary-500 outline-none"
                  >
                    <option value="">Виберіть основну групу</option>
                    {comp.ageGroups?.map(ag => (
                      <option key={ag.id} value={ag.id}>
                        {ag.name} ({ag.birthYearFrom}–{ag.birthYearTo} р.н.)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Групи для об'єднаного рейтингу</label>
                  <div className="space-y-2 bg-bg-dark rounded-lg p-3 border border-white/10 max-h-40 overflow-y-auto">
                    {comp.ageGroups?.map(ag => (
                      <label key={ag.id} className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={mixedSecondaryAgeGroupIds.includes(ag.id)}
                          onChange={() => toggleSecondaryAgeGroup(ag.id)}
                          disabled={ag.id === mixedPrimaryAgeGroupId}
                          className="w-4 h-4 rounded bg-white/10 border border-white/20 checked:bg-primary-500 cursor-pointer"
                        />
                        <span className="text-sm text-slate-300">
                          {ag.name} ({ag.birthYearFrom}–{ag.birthYearTo} р.н.)
                        </span>
                      </label>
                    ))}
                    {(!comp.ageGroups || comp.ageGroups.length === 0) && (
                      <p className="text-xs text-slate-500">Групи не налаштовані</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {protocolFormat === 'COMBINED' && (
              <div className="bg-white/5 p-4 rounded-lg border border-primary-500/20 text-xs text-slate-400">
                Усі вікові категорії будуть об'єднані в один рейтинг. Місця розподіляються справедливо по часам.
              </div>
            )}

            {protocolFormat === 'SEPARATE' && (
              <div className="bg-white/5 p-4 rounded-lg border border-white/10 text-xs text-slate-400">
                Кожна вікова категорія буде мати окремий рейтинг з власним розподілом місць.
              </div>
            )}

            <div className="bg-white/5 p-4 rounded-lg border border-white/10 space-y-3">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <input
                  type="checkbox"
                  checked={advancedGroupingEnabled}
                  onChange={(e) => setAdvancedGroupingEnabled(e.target.checked)}
                  className="w-4 h-4 rounded bg-white/10 border border-white/20 checked:bg-primary-500 cursor-pointer"
                />
                Розширене групування (конструктор умов)
              </label>
              {advancedGroupingEnabled && (
                <div className="space-y-4">
                  {advancedGroups.map((group, groupIndex) => (
                    <div key={groupIndex} className="rounded-lg border border-white/10 p-3 space-y-3 bg-black/10">
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                        <input
                          value={group.name}
                          onChange={(e) => setAdvancedGroups((prev) => prev.map((item, idx) => idx === groupIndex ? { ...item, name: e.target.value } : item))}
                          className="bg-bg-dark border border-white/10 rounded-lg px-3 py-2 text-xs"
                          placeholder="Назва групи"
                        />
                        <select
                          value={group.operator}
                          onChange={(e) => setAdvancedGroups((prev) => prev.map((item, idx) => idx === groupIndex ? { ...item, operator: e.target.value as 'AND' | 'OR' } : item))}
                          className="bg-bg-dark border border-white/10 rounded-lg px-3 py-2 text-xs"
                        >
                          <option value="AND">AND</option>
                          <option value="OR">OR</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => setAdvancedGroups((prev) => [...prev, cloneGroup(group)])}
                          className="text-xs border border-white/20 text-slate-300 rounded-lg px-3 py-2"
                        >
                          Дублювати групу
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdvancedGroups((prev) => prev.map((item, idx) => idx === groupIndex ? { ...item, conditions: [createEmptyCondition()], subgroups: [] } : item))}
                          className="text-xs border border-amber-500/40 text-amber-300 rounded-lg px-3 py-2"
                        >
                          Очистити групу
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdvancedGroups((prev) => prev.filter((_, idx) => idx !== groupIndex))}
                          className="text-xs border border-rose-500/30 text-rose-300 rounded-lg px-3 py-2"
                        >
                          Видалити групу
                        </button>
                      </div>
                      {group.conditions.map((condition, conditionIndex) => {
                        const validationMessage = getConditionValidationMessage(condition);
                        return (
                        <div key={`cond-${groupIndex}-${conditionIndex}`} className="grid grid-cols-1 md:grid-cols-4 gap-2">
                          <select
                            value={condition.field}
                            onChange={(e) => updateGroupCondition(groupIndex, conditionIndex, { ...condition, field: e.target.value as ProtocolCondition['field'] })}
                            className="bg-bg-dark border border-white/10 rounded-lg px-3 py-2 text-xs"
                          >
                            <option value="ageGroupId">Age Group ID</option>
                            <option value="region">Region</option>
                            <option value="club">Club</option>
                            <option value="gender">Gender</option>
                          </select>
                          <select
                            value={condition.operator}
                            onChange={(e) => updateGroupCondition(groupIndex, conditionIndex, { ...condition, operator: e.target.value as ProtocolCondition['operator'] })}
                            className="bg-bg-dark border border-white/10 rounded-lg px-3 py-2 text-xs"
                          >
                            <option value="EQ">EQ</option>
                            <option value="IN">IN</option>
                            <option value="CONTAINS">CONTAINS</option>
                          </select>
                          <input
                            value={stringifyConditionValue(condition)}
                            onChange={(e) => updateGroupCondition(groupIndex, conditionIndex, {
                              ...condition,
                              value: parseConditionValue(condition, e.target.value),
                            })}
                            className={`bg-bg-dark border rounded-lg px-3 py-2 text-xs ${validationMessage ? 'border-amber-500/60' : 'border-white/10'}`}
                            placeholder={condition.operator === 'IN' ? 'v1,v2,v3' : 'value'}
                          />
                          <button
                            type="button"
                            onClick={() => setAdvancedGroups((prev) => prev.map((item, idx) => idx === groupIndex ? ({
                              ...item,
                              conditions: item.conditions.filter((_, ci) => ci !== conditionIndex),
                            }) : item))}
                            className="text-xs border border-rose-500/30 text-rose-300 rounded-lg px-3 py-2"
                          >
                            Видалити умову
                          </button>
                          {validationMessage && (
                            <p className="md:col-span-4 text-[11px] text-amber-300">{validationMessage}</p>
                          )}
                        </div>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setAdvancedGroups((prev) => prev.map((item, idx) => idx === groupIndex ? ({
                          ...item,
                          conditions: [...item.conditions, createEmptyCondition()],
                        }) : item))}
                        className="text-xs border border-white/20 text-slate-300 rounded-lg px-3 py-2"
                      >
                        + Додати умову
                      </button>

                      <div className="space-y-2">
                        {(group.subgroups || []).map((subgroup, subgroupIndex) => (
                          <div key={`sub-${groupIndex}-${subgroupIndex}`} className="rounded-lg border border-white/10 p-2 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] uppercase tracking-widest text-slate-500">Підблок</span>
                              <select
                                value={subgroup.operator}
                                onChange={(e) => setAdvancedGroups((prev) => prev.map((item, idx) => idx === groupIndex ? ({
                                  ...item,
                                  subgroups: (item.subgroups || []).map((s, si) => si === subgroupIndex ? { ...s, operator: e.target.value as 'AND' | 'OR' } : s),
                                }) : item))}
                                className="bg-bg-dark border border-white/10 rounded-lg px-2 py-1 text-xs"
                              >
                                <option value="AND">AND</option>
                                <option value="OR">OR</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => setAdvancedGroups((prev) => prev.map((item, idx) => idx === groupIndex ? ({
                                  ...item,
                                  subgroups: [...(item.subgroups || []), cloneBlock(subgroup)],
                                }) : item))}
                                className="text-xs border border-white/20 text-slate-300 rounded-lg px-2 py-1"
                              >
                                Дублювати підблок
                              </button>
                              <button
                                type="button"
                                onClick={() => setAdvancedGroups((prev) => prev.map((item, idx) => idx === groupIndex ? ({
                                  ...item,
                                  subgroups: (item.subgroups || []).filter((_, si) => si !== subgroupIndex),
                                }) : item))}
                                className="text-xs border border-rose-500/30 text-rose-300 rounded-lg px-2 py-1"
                              >
                                Видалити підблок
                              </button>
                            </div>
                            {subgroup.conditions.map((condition, conditionIndex) => {
                              const validationMessage = getConditionValidationMessage(condition);
                              return (
                              <div key={`sub-cond-${groupIndex}-${subgroupIndex}-${conditionIndex}`} className="grid grid-cols-1 md:grid-cols-4 gap-2">
                                <select
                                  value={condition.field}
                                  onChange={(e) => updateSubgroupCondition(groupIndex, subgroupIndex, conditionIndex, { ...condition, field: e.target.value as ProtocolCondition['field'] })}
                                  className="bg-bg-dark border border-white/10 rounded-lg px-3 py-2 text-xs"
                                >
                                  <option value="ageGroupId">Age Group ID</option>
                                  <option value="region">Region</option>
                                  <option value="club">Club</option>
                                  <option value="gender">Gender</option>
                                </select>
                                <select
                                  value={condition.operator}
                                  onChange={(e) => updateSubgroupCondition(groupIndex, subgroupIndex, conditionIndex, { ...condition, operator: e.target.value as ProtocolCondition['operator'] })}
                                  className="bg-bg-dark border border-white/10 rounded-lg px-3 py-2 text-xs"
                                >
                                  <option value="EQ">EQ</option>
                                  <option value="IN">IN</option>
                                  <option value="CONTAINS">CONTAINS</option>
                                </select>
                                <input
                                  value={stringifyConditionValue(condition)}
                                  onChange={(e) => updateSubgroupCondition(groupIndex, subgroupIndex, conditionIndex, {
                                    ...condition,
                                    value: parseConditionValue(condition, e.target.value),
                                  })}
                                  className={`bg-bg-dark border rounded-lg px-3 py-2 text-xs ${validationMessage ? 'border-amber-500/60' : 'border-white/10'}`}
                                  placeholder={condition.operator === 'IN' ? 'v1,v2,v3' : 'value'}
                                />
                                <button
                                  type="button"
                                  onClick={() => setAdvancedGroups((prev) => prev.map((item, idx) => idx === groupIndex ? ({
                                    ...item,
                                    subgroups: (item.subgroups || []).map((sub, si) => si === subgroupIndex ? ({
                                      ...sub,
                                      conditions: sub.conditions.filter((_, ci) => ci !== conditionIndex),
                                    }) : sub),
                                  }) : item))}
                                  className="text-xs border border-rose-500/30 text-rose-300 rounded-lg px-3 py-2"
                                >
                                  Видалити умову
                                </button>
                                {validationMessage && (
                                  <p className="md:col-span-4 text-[11px] text-amber-300">{validationMessage}</p>
                                )}
                              </div>
                              );
                            })}
                            <button
                              type="button"
                              onClick={() => setAdvancedGroups((prev) => prev.map((item, idx) => idx === groupIndex ? ({
                                ...item,
                                subgroups: (item.subgroups || []).map((sub, si) => si === subgroupIndex ? ({
                                  ...sub,
                                  conditions: [...sub.conditions, createEmptyCondition()],
                                }) : sub),
                              }) : item))}
                              className="text-xs border border-white/20 text-slate-300 rounded-lg px-3 py-2"
                            >
                              + Додати умову у підблок
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setAdvancedGroups((prev) => prev.map((item, idx) => idx === groupIndex ? ({
                            ...item,
                            subgroups: [...(item.subgroups || []), createEmptyBlock()],
                          }) : item))}
                          className="text-xs border border-white/20 text-slate-300 rounded-lg px-3 py-2"
                        >
                          + Додати підблок умов
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setAdvancedGroups((prev) => [...prev, createEmptyGroup()])} className="text-xs border border-white/20 text-slate-300 rounded-lg px-3 py-2">
                      + Додати групу
                    </button>
                    <label className="flex items-center gap-2 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={includeUnmatched}
                        onChange={(e) => setIncludeUnmatched(e.target.checked)}
                        className="w-4 h-4 rounded bg-white/10 border border-white/20 checked:bg-primary-500 cursor-pointer"
                      />
                      Додати групу для незіставлених записів
                    </label>
                    {includeUnmatched && (
                      <Fragment>
                        <input
                          value={unmatchedGroupName}
                          onChange={(e) => setUnmatchedGroupName(e.target.value)}
                          className={`bg-bg-dark border rounded-lg px-3 py-2 text-xs ${unmatchedGroupName.trim() ? 'border-white/10' : 'border-amber-500/60'}`}
                          placeholder="Назва групи для інших"
                        />
                        {!unmatchedGroupName.trim() && (
                          <p className="text-[11px] text-amber-300">Назва групи для незіставлених записів обов'язкова.</p>
                        )}
                      </Fragment>
                    )}
                    <p className="w-full text-[11px] text-slate-500">
                      Пріоритет правил: групи застосовуються зверху вниз, перша відповідна група забирає запис.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white/5 p-4 rounded-lg border border-white/10 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Пресети та дефолти</h4>
              {presetsLoading ? (
                <p className="text-xs text-slate-500">Завантаження...</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <input
                      value={newPresetName}
                      onChange={(e) => setNewPresetName(e.target.value)}
                      className="bg-bg-dark border border-white/10 rounded-lg px-3 py-2 text-xs flex-1 min-w-[180px]"
                      placeholder="Назва нового пресета"
                    />
                    <label className="flex items-center gap-2 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={newPresetShared}
                        onChange={(e) => setNewPresetShared(e.target.checked)}
                        disabled={!isAdmin}
                        className="w-4 h-4 rounded bg-white/10 border border-white/20 checked:bg-primary-500 cursor-pointer disabled:opacity-50"
                      />
                      Shared
                    </label>
                    {!isAdmin && <p className="text-[11px] text-slate-500">Shared-пресети може створювати лише адміністратор.</p>}
                    <button
                      type="button"
                      onClick={handleCreatePreset}
                      disabled={!canManageProtocol}
                      className="text-xs border border-white/20 text-slate-200 rounded-lg px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Зберегти як пресет
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveMyDefaults}
                      disabled={!canManageProtocol}
                      className="text-xs border border-primary-500/30 text-primary-300 rounded-lg px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Оновити мої дефолти
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyMyDefaults}
                      disabled={!myDefaults || !canManageProtocol}
                      className="text-xs border border-white/20 text-slate-200 rounded-lg px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Застосувати мої дефолти
                    </button>
                  </div>
                  {!canManageProtocol && (
                    <p className="text-[11px] text-amber-400">
                      Редагування протоколів доступне лише ролям admin або secretary.
                    </p>
                  )}
                  <div className="space-y-2">
                    {presets.map((preset) => (
                      <div key={preset.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs">
                        {editingPresetId === preset.id ? (
                          <>
                            <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                              <input
                                value={editingPresetName}
                                onChange={(e) => setEditingPresetName(e.target.value)}
                                className="bg-bg-dark border border-white/10 rounded-lg px-2 py-1 text-xs flex-1"
                                placeholder="Назва пресета"
                              />
                              <label className="flex items-center gap-1 text-xs text-slate-300">
                                <input
                                  type="checkbox"
                                  checked={editingPresetShared}
                                  onChange={(e) => setEditingPresetShared(e.target.checked)}
                                  disabled={!isAdmin}
                                  className="w-4 h-4 rounded bg-white/10 border border-white/20 checked:bg-primary-500 cursor-pointer disabled:opacity-50"
                                />
                                Shared
                              </label>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleSavePresetChanges(preset.id)}
                                disabled={!canEditPreset(preset)}
                                className="border border-emerald-500/30 rounded-lg px-2 py-1 text-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Зберегти
                              </button>
                              <button type="button" onClick={handleCancelEditPreset} className="border border-white/20 rounded-lg px-2 py-1 text-slate-300">Скасувати</button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-slate-300">
                              <span className="font-bold">{preset.name}</span>
                              {preset.isShared && <span className="ml-2 text-primary-400">shared</span>}
                              {!canEditPreset(preset) && canManageProtocol && (
                                <span className="ml-2 text-amber-400">тільки для власника</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleApplyPreset(preset)}
                                disabled={!canApplyPreset(preset)}
                                className="border border-white/20 rounded-lg px-2 py-1 text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Застосувати
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStartEditPreset(preset)}
                                disabled={!canEditPreset(preset)}
                                className="border border-white/20 rounded-lg px-2 py-1 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Редагувати
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePreset(preset.id)}
                                disabled={!canEditPreset(preset)}
                                className="border border-rose-500/30 rounded-lg px-2 py-1 text-rose-300 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Видалити
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                    {presets.length === 0 && <p className="text-xs text-slate-500">Поки що немає пресетів</p>}
                  </div>
                </>
              )}
            </div>

            <button
              onClick={handleSaveProtocolConfig}
              disabled={!canManageProtocol}
              className="btn-primary w-full py-2 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Зберегти налаштування протокол
            </button>
          </div>
        </div>

        <div className="bg-primary-500/10 border border-primary-500/20 rounded-2xl p-6 flex items-start gap-4">
          <Info className="w-6 h-6 text-primary-400 shrink-0 mt-1" />
          <div>
            <h4 className="font-bold text-primary-400 mb-2 font-black uppercase text-xs tracking-widest">Підказка</h4>
            <p className="text-sm text-slate-400 leading-relaxed">
              Налаштування вікових груп дозволяє системі автоматично розділяти результати при завантаженні фінішних протоколів. Переконайтеся, що роки народження не перекриваються.
            </p>
          </div>
        </div>
        {isAdmin && (
          <div className="glass-card p-6 border-rose-500/30 bg-rose-500/5">
            <h3 className="text-xs font-black text-rose-400 uppercase tracking-[0.2em] mb-3">Адмін-операція</h3>
            <button
              onClick={() => setConfirmAction('delete')}
              className="w-full bg-rose-600 hover:bg-rose-500 text-white rounded-2xl py-3 text-xs font-black uppercase tracking-widest transition-all"
            >
              Видалити змагання
            </button>
          </div>
        )}
      </section>
      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={
          confirmAction === 'complete'
            ? 'Завершити змагання?'
            : confirmAction === 'delete'
              ? 'Видалити змагання?'
              : 'Повернути в чернетку?'
        }
        description={
          confirmAction === 'complete'
            ? 'Після завершення результати буде зафіксовано в архіві.'
            : confirmAction === 'delete'
              ? 'Операція незворотна: буде видалено змагання та пов’язані дані.'
              : 'Статус повернеться до чернетки, і частина дій знову стане доступною для редагування.'
        }
        confirmText={
          confirmAction === 'complete'
            ? 'Так, завершити'
            : confirmAction === 'delete'
              ? 'Так, видалити'
              : 'Так, повернути'
        }
        cancelText="Скасувати"
        danger={confirmAction === 'complete' || confirmAction === 'delete'}
        onConfirm={() => {
          if (!confirmAction) return;
          if (confirmAction === 'delete') {
            void handleDeleteCompetition();
          } else {
            void handleUpdateStatus(confirmAction === 'complete' ? 'completed' : 'draft');
          }
          setConfirmAction(null);
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
