import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

interface Record {
  id: string;
  customer_name: string;
  city: string;
  submit_date: string;
  is_locked: boolean;
  created_at: string;
}

interface Filters {
  customer_name: string;
  city: string;
  lock_status: 'all' | 'locked' | 'unlocked';
  start_date: string;
  end_date: string;
  submitter: string;
}

export default function RecordList() {
  const [records, setRecords] = useState<Record[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    customer_name: '',
    city: '',
    lock_status: 'all',
    start_date: '',
    end_date: '',
    submitter: '',
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { user } = useAuth();
  const allSelected = records.length > 0 && records.every((record) => selectedIds.includes(record.id));

  const fetchRecords = useCallback(async (currentFilters: Filters) => {
    setIsLoading(true);
    try {
      const lockStatusParam = currentFilters.lock_status === 'all' ? undefined : currentFilters.lock_status === 'locked';
      const response = await api.get('/records/', {
        params: {
          customer_name: currentFilters.customer_name || undefined,
          city: currentFilters.city || undefined,
          is_locked: lockStatusParam,
          start_date: currentFilters.start_date || undefined,
          end_date: currentFilters.end_date || undefined,
          submitter: currentFilters.submitter || undefined
        }
      });
      setRecords(response.data);
      setSelectedIds([]);
    } catch (error) {
      console.error('Failed to fetch records:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords({
      customer_name: '',
      city: '',
      lock_status: 'all',
      start_date: '',
      end_date: '',
      submitter: ''
    });
  }, [fetchRecords]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRecords(filters);
  };

  const handleResetFilters = () => {
    const defaultFilters: Filters = {
      customer_name: '',
      city: '',
      lock_status: 'all',
      start_date: '',
      end_date: '',
      submitter: ''
    };
    setFilters({
      customer_name: defaultFilters.customer_name,
      city: defaultFilters.city,
      lock_status: defaultFilters.lock_status,
      start_date: defaultFilters.start_date,
      end_date: defaultFilters.end_date,
      submitter: defaultFilters.submitter
    });
    fetchRecords(defaultFilters);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('确定要删除这条记录吗？')) return;
    try {
      await api.delete(`/records/${id}`);
      setRecords(records.filter(r => r.id !== id));
      setSelectedIds(selectedIds.filter((selectedId) => selectedId !== id));
    } catch (error) {
      console.error('Failed to delete record:', error);
      alert('删除失败');
    }
  };

  const handleToggleLock = async (id: string, isLocked: boolean) => {
    try {
      const action = isLocked ? 'unlock' : 'lock';
      await api.post(`/admin/records/${id}/${action}`);
      setRecords(records.map(r => r.id === id ? { ...r, is_locked: !isLocked } : r));
    } catch (error) {
      console.error('Failed to toggle lock:', error);
      alert('操作失败');
    }
  };

  const handleExport = async () => {
    try {
      if (selectedIds.length === 0) return alert('没有数据可导出');
      
      const response = await api.post('/export/excel', selectedIds, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `exchange_records_${format(new Date(), 'yyyyMMdd')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (error) {
      console.error('Export failed:', error);
      alert('导出失败');
    }
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(records.map((record) => record.id));
  };

  const toggleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((selectedId) => selectedId !== id));
      return;
    }
    setSelectedIds([...selectedIds, id]);
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800">交流记录管理</h2>
        <div className="flex space-x-3">
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={selectedIds.length === 0}
          >
            导出所选 ({selectedIds.length})
          </button>
          <Link
            to="/records/new"
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors"
          >
            新建记录
          </Link>
        </div>
      </div>

      <form onSubmit={handleSearch} className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-7">
        <input
          type="text"
          placeholder="客户名称"
          value={filters.customer_name}
          onChange={(e) => setFilters({ ...filters, customer_name: e.target.value })}
          className="px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-primary"
        />
        <input
          type="text"
          placeholder="城市"
          value={filters.city}
          onChange={(e) => setFilters({ ...filters, city: e.target.value })}
          className="px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-primary"
        />
        <input
          type="text"
          placeholder="提交人（工号/姓名）"
          value={filters.submitter}
          onChange={(e) => setFilters({ ...filters, submitter: e.target.value })}
          className="px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-primary"
        />
        <input
          type="date"
          value={filters.start_date}
          onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
          className="px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-primary"
        />
        <input
          type="date"
          value={filters.end_date}
          onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
          className="px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-primary"
        />
        <select
          value={filters.lock_status}
          onChange={(e) => setFilters({ ...filters, lock_status: e.target.value as Filters['lock_status'] })}
          className="px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-primary bg-white"
        >
          <option value="all">全部状态</option>
          <option value="unlocked">可编辑</option>
          <option value="locked">已锁定</option>
        </select>
        <div className="flex space-x-2">
          <button type="submit" className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
            筛选
          </button>
          <button
            type="button"
            onClick={handleResetFilters}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
          >
            重置
          </button>
        </div>
      </form>

      {isLoading ? (
        <div className="text-center py-10 text-gray-500">加载中...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">客户名称</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">城市</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">交流日期</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {records.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap text-sm">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(record.id)}
                      onChange={() => toggleSelectOne(record.id)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{record.customer_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.city}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.submit_date}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${record.is_locked ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                      {record.is_locked ? '已锁定' : '可编辑'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                    {(!record.is_locked || user?.role === 'admin') && (
                      <Link to={`/records/${record.id}/edit`} className="text-primary hover:text-primary-dark">编辑</Link>
                    )}
                    {(!record.is_locked || user?.role === 'admin') && (
                      <button onClick={() => handleDelete(record.id)} className="text-red-600 hover:text-red-900">删除</button>
                    )}
                    {user?.role === 'admin' && (
                      <button 
                        onClick={() => handleToggleLock(record.id, record.is_locked)} 
                        className="text-orange-600 hover:text-orange-900"
                      >
                        {record.is_locked ? '解锁' : '锁定'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-500">暂无数据</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
