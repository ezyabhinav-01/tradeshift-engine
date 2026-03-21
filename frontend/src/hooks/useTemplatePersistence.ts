import { useEffect, useCallback } from 'react';
import { useChartObjects } from '../store/useChartObjects';
import type { DrawingTemplate, ToolTemplate } from '../store/useChartObjects';
import axios from 'axios';

const API_BASE = '/api/user';

export const useTemplatePersistence = () => {
  const { setTemplates, setToolTemplates } = useChartObjects();

  const fetchTemplates = useCallback(async () => {
    try {
      const [templatesRes, settingsRes] = await Promise.all([
        axios.get(`${API_BASE}/templates`),
        axios.get(`${API_BASE}/chart-settings`)
      ]);
      
      if (templatesRes.data) {
        setTemplates(templatesRes.data);
      }
      
      if (settingsRes.data?.tool_templates) {
        // Convert map to array for store
        const mapped = Object.entries(settingsRes.data.tool_templates).flatMap(([toolId, templates]: [string, any]) => 
          Object.values(templates).map((t: any) => ({
            ...t,
            toolId
          }))
        );
        setToolTemplates(mapped);
      }
    } catch (err) {
      console.error('Failed to fetch templates from backend', err);
    }
  }, [setTemplates, setToolTemplates]);

  const saveDrawingTemplate = async (template: DrawingTemplate) => {
    try {
      await axios.post(`${API_BASE}/templates`, {
        ...template,
        timestamp: new Date().toISOString()
      });
      // Store update is handled by the component calling saveTemplate normally, 
      // but we could also re-sync here.
    } catch (err) {
      console.error('Failed to save drawing template to backend', err);
    }
  };

  const deleteDrawingTemplate = async (id: string) => {
    try {
      await axios.delete(`${API_BASE}/templates/${id}`);
    } catch (err) {
      console.error('Failed to delete drawing template from backend', err);
    }
  };

  const saveToolTemplate = async (template: ToolTemplate) => {
    try {
      // Get current settings to update the map
      const res = await axios.get(`${API_BASE}/chart-settings`);
      const current = res.data.tool_templates || {};
      
      if (!current[template.toolId]) current[template.toolId] = {};
      current[template.toolId][template.id] = template;

      await axios.put(`${API_BASE}/chart-settings`, {
        tool_templates: current
      });
    } catch (err) {
      console.error('Failed to save tool template to backend', err);
    }
  };

  const deleteToolTemplate = async (toolId: string, templateId: string) => {
    try {
      const res = await axios.get(`${API_BASE}/chart-settings`);
      const current = res.data.tool_templates || {};
      
      if (current[toolId]) {
        delete current[toolId][templateId];
        await axios.put(`${API_BASE}/chart-settings`, {
          tool_templates: current
        });
      }
    } catch (err) {
      console.error('Failed to delete tool template from backend', err);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return {
    saveDrawingTemplate,
    deleteDrawingTemplate,
    saveToolTemplate,
    deleteToolTemplate,
    refresh: fetchTemplates
  };
};
