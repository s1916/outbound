import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useFieldArray, useForm as useRHForm } from 'react-hook-form';
import api from '../services/api';

interface Participant {
  type: 'internal' | 'external';
  name_or_employee_id: string;
}

interface RecordFormData {
  customer_name: string;
  city: string;
  submit_date: string;
  participants: Participant[];
}

interface Attachment {
  id: string;
  file_name: string;
}

interface ApiErrorResponse {
  response?: {
    data?: {
      detail?: string;
    };
  };
}

interface UserSuggestion {
  employee_id: string;
  name: string;
  department: string;
}

export default function RecordForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<Attachment[]>([]);
  const [internalSuggestions, setInternalSuggestions] = useState<Record<number, UserSuggestion[]>>({});
  const searchTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const { register, control, watch, setValue, getValues, handleSubmit, reset, formState: { errors } } = useRHForm<RecordFormData>({
    defaultValues: {
      customer_name: '',
      city: '',
      submit_date: new Date().toISOString().split('T')[0],
      participants: [{ type: 'internal', name_or_employee_id: '' }]
    }
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'participants'
  });
  const participants = watch('participants');

  const fetchInternalSuggestions = useCallback(async (index: number, keyword: string) => {
    const trimmedKeyword = keyword.trim();
    if (!trimmedKeyword) {
      setInternalSuggestions((prev) => ({ ...prev, [index]: [] }));
      return;
    }
    try {
      const response = await api.get('/auth/users/search', {
        params: { q: trimmedKeyword, limit: 8 }
      });
      setInternalSuggestions((prev) => ({ ...prev, [index]: response.data }));
    } catch (error) {
      console.error('Failed to search users:', error);
      setInternalSuggestions((prev) => ({ ...prev, [index]: [] }));
    }
  }, []);

  const scheduleInternalSearch = useCallback((index: number, keyword: string) => {
    const previousTimer = searchTimers.current[index];
    if (previousTimer) {
      clearTimeout(previousTimer);
    }
    if (!keyword.trim()) {
      setInternalSuggestions((prev) => ({ ...prev, [index]: [] }));
      return;
    }
    searchTimers.current[index] = setTimeout(() => {
      void fetchInternalSuggestions(index, keyword);
    }, 250);
  }, [fetchInternalSuggestions]);

  const selectInternalUser = (index: number, user: UserSuggestion) => {
    setValue(`participants.${index}.name_or_employee_id`, user.employee_id, { shouldDirty: true });
    setInternalSuggestions((prev) => ({ ...prev, [index]: [] }));
  };

  const fetchRecord = useCallback(async () => {
    try {
      const response = await api.get(`/records/${id}`);
      const data = response.data;
      reset({
        customer_name: data.customer_name,
        city: data.city,
        submit_date: data.submit_date,
        participants: data.participants.length ? data.participants : [{ type: 'internal', name_or_employee_id: '' }]
      });
      setExistingAttachments(data.attachments || []);
      setInternalSuggestions({});
    } catch (error) {
      console.error('Failed to fetch record:', error);
      alert('获取记录失败或您没有权限修改');
      navigate('/records');
    }
  }, [id, navigate, reset]);

  useEffect(() => {
    if (isEdit) {
      fetchRecord();
    }
  }, [fetchRecord, isEdit]);

  useEffect(() => {
    const timers = searchTimers.current;
    return () => {
      Object.values(timers).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const onSubmit = async (data: RecordFormData) => {
    setIsLoading(true);
    try {
      let recordId = id;
      const payload = {
        ...data,
        participants: data.participants.filter((participant) => participant.name_or_employee_id.trim())
      };
      
      if (isEdit) {
        await api.put(`/records/${id}`, payload);
      } else {
        const response = await api.post('/records/', payload);
        recordId = response.data.id;
      }

      // Handle file uploads
      if (files.length > 0 && recordId) {
        for (const file of files) {
          const formData = new FormData();
          formData.append('file', file);
          await api.post(`/files/upload/${recordId}`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });
        }
      }

      alert('保存成功！');
      navigate('/records');
    } catch (error: unknown) {
      console.error('Save failed:', error);
      const errorMessage = (error as ApiErrorResponse).response?.data?.detail || '保存失败，请检查输入';
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadFile = async (attachmentId: string, fileName: string) => {
    try {
      const response = await api.get(`/files/download/${attachmentId}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (error) {
      console.error('Download failed', error);
      alert('下载失败');
    }
  };

  return (
    <div className="max-w-3xl mx-auto bg-white shadow rounded-lg p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">
        {isEdit ? '编辑交流记录' : '新建交流记录'}
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">客户名称 <span className="text-red-500">*</span></label>
            <input
              type="text"
              {...register('customer_name', { required: '请输入客户名称' })}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
            />
            {errors.customer_name && <p className="mt-1 text-sm text-red-600">{errors.customer_name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">所在城市 <span className="text-red-500">*</span></label>
            <input
              type="text"
              {...register('city', { required: '请输入所在城市' })}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
            />
            {errors.city && <p className="mt-1 text-sm text-red-600">{errors.city.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">交流日期 <span className="text-red-500">*</span></label>
            <input
              type="date"
              {...register('submit_date', { required: '请选择日期' })}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
            />
            {errors.submit_date && <p className="mt-1 text-sm text-red-600">{errors.submit_date.message}</p>}
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">参与人员</h3>
            <button
              type="button"
              onClick={() => append({ type: 'internal', name_or_employee_id: '' })}
              className="px-3 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm"
            >
              添加参与人
            </button>
          </div>

          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-1 gap-3 md:grid-cols-[140px_1fr_auto] items-center">
                <select
                  {...register(`participants.${index}.type`, {
                    onChange: (event) => {
                      const value = event.target.value as Participant['type'];
                      if (value !== 'internal') {
                        setInternalSuggestions((prev) => ({ ...prev, [index]: [] }));
                        return;
                      }
                      const currentInput = getValues(`participants.${index}.name_or_employee_id`);
                      scheduleInternalSearch(index, currentInput || '');
                    }
                  })}
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-white"
                >
                  <option value="internal">本公司</option>
                  <option value="external">对方公司</option>
                </select>
                <div className="relative">
                  <input
                    type="text"
                    {...register(`participants.${index}.name_or_employee_id`, {
                      onChange: (event) => {
                        const value = event.target.value as string;
                        if (participants?.[index]?.type === 'internal') {
                          scheduleInternalSearch(index, value);
                          return;
                        }
                        setInternalSuggestions((prev) => ({ ...prev, [index]: [] }));
                      }
                    })}
                    className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                    placeholder={participants?.[index]?.type === 'external' ? '请输入对方姓名' : '请输入本公司工号或姓名'}
                    onFocus={() => {
                      if (participants?.[index]?.type !== 'internal') {
                        return;
                      }
                      const currentInput = getValues(`participants.${index}.name_or_employee_id`);
                      scheduleInternalSearch(index, currentInput || '');
                    }}
                    onBlur={() => {
                      setTimeout(() => {
                        setInternalSuggestions((prev) => ({ ...prev, [index]: [] }));
                      }, 150);
                    }}
                  />
                  {participants?.[index]?.type === 'internal' && (internalSuggestions[index]?.length || 0) > 0 && (
                    <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-56 overflow-auto">
                      {internalSuggestions[index].map((user) => (
                        <button
                          key={user.employee_id}
                          type="button"
                          onClick={() => selectInternalUser(index, user)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-b-0 border-gray-100"
                        >
                          <div className="text-sm text-gray-900">{user.name}</div>
                          <div className="text-xs text-gray-500">{user.employee_id} · {user.department}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    remove(index);
                    setInternalSuggestions({});
                  }}
                  disabled={fields.length === 1}
                  className="px-3 py-2 border border-red-300 text-red-600 rounded hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">附件上传</h3>
          
          {existingAttachments.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-sm text-gray-500">已上传文件：</p>
              {existingAttachments.map(att => (
                <div key={att.id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                  <span className="text-sm text-gray-700">{att.file_name}</span>
                  <button 
                    type="button" 
                    onClick={() => downloadFile(att.id, att.file_name)}
                    className="text-primary hover:text-primary-dark text-sm"
                  >
                    下载
                  </button>
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">
              添加新文件 (支持 JPG, PNG, PDF，最大 20MB)
            </label>
            <input
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={(e) => {
                if (e.target.files) {
                  setFiles(Array.from(e.target.files));
                }
              }}
              className="mt-1 block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-primary-light file:text-primary-dark
                hover:file:bg-blue-100"
            />
          </div>
        </div>

        <div className="pt-5 flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate('/records')}
            className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
          >
            {isLoading ? '保存中...' : '保存'}
          </button>
        </div>
      </form>
    </div>
  );
}
