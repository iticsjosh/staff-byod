import React, { useState, useMemo } from 'react';
import { Staff } from './data';
import { useStaffData } from './hooks/useStaffData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Search, Users, ArrowUpDown, UserMinus, Shield, Plus, X, Trash2, ChevronDown, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Status = 'Active' | 'Resigned' | 'Exempted';

type LocalStaff = Staff & { markedAsExit?: boolean; y1?: string; isPendingExit?: boolean; pendingExitColumn?: string };

function getStatus(staff: LocalStaff): Status {
  if (staff.markedAsExit) return 'Resigned';
  if (staff.onboardingYear === 'exempted') return 'Exempted';
  if (staff.y1 === 'exit' || staff.y2 === 'exit' || staff.y3 === 'exit' || staff.y4 === 'exit') return 'Resigned';
  return 'Active';
}

function getReimbursement(staff: LocalStaff, status: Status): number | null {
  if (status !== 'Resigned') return null;
  if (staff.onboardingYear === 'exempted') return null;

  // Direct column-based reimbursement
  if (staff.y1 === 'exit') return 1500;
  if (staff.y2 === 'exit') return 1150;
  if (staff.y3 === 'exit') return 800;
  if (staff.y4 === 'exit') return 400;

  return null;
}

function getExitOptions(staff: Staff) {
  const onboardYear = parseInt(staff.onboardingYear as string, 10);
  if (isNaN(onboardYear)) return [];

  const options: { column: string; label: string; reimbursement: number }[] = [];
  const y1Val = (onboardYear + 1).toString();

  options.push({ column: 'y1', label: `Y1 — End SY ${y1Val}`, reimbursement: 1500 });
  if (staff.y2 && staff.y2 !== 'exit')
    options.push({ column: 'y2', label: `Y2 — End SY ${staff.y2}`, reimbursement: 1150 });
  if (staff.y3 && staff.y3 !== 'exit')
    options.push({ column: 'y3', label: `Y3 — End SY ${staff.y3}`, reimbursement: 800 });
  if (staff.y4 && staff.y4 !== 'exit')
    options.push({ column: 'y4', label: `Y4 — End SY ${staff.y4}`, reimbursement: 400 });

  return options;
}

type SortConfig = {
  key: keyof LocalStaff | 'status' | 'reimbursement' | 'y1';
  direction: 'asc' | 'desc';
} | null;

export default function App() {
  const { staffList, loading, error, addStaff, updateStaff, deleteStaff, refetch } = useStaffData();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<string[] | null>(null);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffYear, setNewStaffYear] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [bulkActionDropdownOpen, setBulkActionDropdownOpen] = useState(false);
  const [exitModalStaffId, setExitModalStaffId] = useState<string | null>(null);
  const [selectedExitColumn, setSelectedExitColumn] = useState<string>('');
  const [pendingExits, setPendingExits] = useState<Map<string, string>>(new Map());

  const exitModalStaff = exitModalStaffId
    ? staffList.find(s => s.id === exitModalStaffId) ?? null
    : null;

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName || !newStaffYear) return;

    const onboardYear = parseInt(newStaffYear, 10);
    const isExempted = newStaffYear.toLowerCase() === 'exempted';

    const newStaff: Omit<Staff, 'id'> = {
      name: newStaffName,
      onboardingYear: isExempted ? 'exempted' : newStaffYear,
      y2: isExempted || isNaN(onboardYear) ? '' : (onboardYear + 2).toString(),
      y3: isExempted || isNaN(onboardYear) ? '' : (onboardYear + 3).toString(),
      y4: isExempted || isNaN(onboardYear) ? '' : (onboardYear + 4).toString(),
      renewal: isExempted || isNaN(onboardYear) ? '' : (onboardYear + 4).toString(),
      notes: ''
    };

    await addStaff(newStaff);
    setIsAddModalOpen(false);
    setNewStaffName('');
    setNewStaffYear('');
  };

  const handleSort = (key: keyof LocalStaff | 'status' | 'reimbursement') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const openExitModal = (staffId: string) => {
    setExitModalStaffId(staffId);
    setSelectedExitColumn('');
  };

  const handleConfirmExit = () => {
    if (!exitModalStaffId || !selectedExitColumn) return;
    setPendingExits(prev => new Map(prev).set(exitModalStaffId, selectedExitColumn));
    setExitModalStaffId(null);
    setSelectedExitColumn('');
  };

  const handleUndoExit = (staffId: string) => {
    setPendingExits(prev => {
      const next = new Map(prev);
      next.delete(staffId);
      return next;
    });
  };

  const handleSaveExit = async (staffId: string) => {
    const exitCol = pendingExits.get(staffId);
    if (!exitCol) return;

    const staff = staffList.find(s => s.id === staffId);
    if (!staff) return;

    // Send the full staff record with the exit column applied
    const fullUpdate: Partial<Staff> = {
      id: staff.id,
      name: staff.name,
      onboardingYear: staff.onboardingYear,
      y2: staff.y2,
      y3: staff.y3,
      y4: staff.y4,
      renewal: staff.renewal,
    };

    if (exitCol === 'y2') fullUpdate.y2 = 'exit';
    else if (exitCol === 'y3') fullUpdate.y3 = 'exit';
    else if (exitCol === 'y4') fullUpdate.y4 = 'exit';

    await updateStaff(staffId, fullUpdate);
    handleUndoExit(staffId);
  };

  const confirmDelete = async () => {
    if (staffToDelete) {
      for (const name of staffToDelete) {
        const staff = staffList.find(s => s.name === name);
        if (staff && staff.id) {
          await deleteStaff(staff.id);
        }
      }
      setStaffToDelete(null);
      setSelectedStaff(prev => prev.filter(name => !staffToDelete.includes(name)));
    }
  };

  const processedData = useMemo(() => {
    return staffList.map(staff => {
      const pendingExit = staff.id ? pendingExits.get(staff.id) : undefined;
      const onboardYear = parseInt(staff.onboardingYear as string, 10);

      const displayStaff: LocalStaff = {
        ...staff,
        y1: !isNaN(onboardYear) ? (onboardYear + 1).toString() : '',
        markedAsExit: !!pendingExit,
        isPendingExit: !!pendingExit,
        pendingExitColumn: pendingExit,
      };

      // Apply exit to the correct column for pending (unsaved) exits
      if (pendingExit === 'y1') displayStaff.y1 = 'exit';
      else if (pendingExit === 'y2') displayStaff.y2 = 'exit';
      else if (pendingExit === 'y3') displayStaff.y3 = 'exit';
      else if (pendingExit === 'y4') displayStaff.y4 = 'exit';

      const status = getStatus(displayStaff);

      return {
        ...displayStaff,
        status,
        reimbursement: getReimbursement(displayStaff, status)
      };
    });
  }, [staffList, pendingExits]);

  const filteredData = useMemo(() => {
    let filtered = processedData.filter(staff => {
      const matchesSearch = staff.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || staff.status.toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });

    if (sortConfig !== null) {
      filtered.sort((a, b) => {
        let aValue = a[sortConfig.key as keyof typeof a];
        let bValue = b[sortConfig.key as keyof typeof b];

        if (aValue === undefined || aValue === null) aValue = '';
        if (bValue === undefined || bValue === null) bValue = '';

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered;
  }, [processedData, searchTerm, statusFilter, sortConfig]);

  const activeStaffCount = processedData.filter(s => s.status === 'Active').length;
  const exitStaffCount = processedData.filter(s => s.status === 'Resigned').length;
  const exemptedStaffCount = processedData.filter(s => s.status === 'Exempted').length;

  const SortableHead = ({ label, sortKey, isSpecial }: { label: string, sortKey: keyof LocalStaff | 'status' | 'reimbursement', isSpecial?: boolean }) => (
    <TableHead 
      className={`cursor-pointer transition-colors select-none ${isSpecial ? 'bg-red-900 hover:bg-red-800 text-white' : 'bg-blue-900 hover:bg-blue-800 text-white'}`}
      onClick={() => handleSort(sortKey)}
    >
      <div className="flex items-center space-x-1">
        <span>{label}</span>
        <ArrowUpDown className={`w-3 h-3 ${isSpecial ? 'text-red-200' : 'text-blue-200'}`} />
      </div>
    </TableHead>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <img 
              src="https://resources.finalsite.net/images/f_auto,q_auto/v1622188341/ics/fvi34ugb5edtsbwzddiv/2014-ICS-Logo-FINAL.jpg" 
              alt="ICS Logo" 
              className="h-12 object-contain rounded-md"
              referrerPolicy="no-referrer"
            />
            <h1 className="text-3xl font-bold tracking-tight text-blue-900">Staff BYOD Dashboard</h1>
          </div>
          <Button 
            variant="outline" 
            onClick={() => refetch()}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {error && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                API unavailable — showing cached data
              </p>
              <p className="text-xs text-amber-600 mt-1">{error}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-400">
            <Loader2 className="w-10 h-10 animate-spin mb-4" />
            <p className="text-sm font-medium">Loading staff data…</p>
          </div>
        ) : (
          <>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-t-4 border-t-blue-600 shadow-sm">
            <CardContent className="p-6 flex items-center space-x-4">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-500">Active BYOD Staff</p>
                <h3 className="text-2xl font-semibold text-neutral-900">{activeStaffCount}</h3>
              </div>
            </CardContent>
          </Card>
          <Card className="border-t-4 border-t-red-600 shadow-sm">
            <CardContent className="p-6 flex items-center space-x-4">
              <div className="p-3 bg-red-100 text-red-600 rounded-lg">
                <UserMinus className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-500">Exited Staff</p>
                <h3 className="text-2xl font-semibold text-neutral-900">{exitStaffCount}</h3>
              </div>
            </CardContent>
          </Card>
          <Card className="border-t-4 border-t-slate-600 shadow-sm">
            <CardContent className="p-6 flex items-center space-x-4">
              <div className="p-3 bg-slate-100 text-slate-600 rounded-lg">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-500">Exempted Staff</p>
                <h3 className="text-2xl font-semibold text-neutral-900">{exemptedStaffCount}</h3>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-t-4 border-t-red-600 shadow-sm">
          <CardHeader>
            <CardTitle className="text-blue-900">Staff Directory</CardTitle>
            <CardDescription>View and filter staff BYOD details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <Input 
                  placeholder="Search staff by name..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="resigned">Resigned</SelectItem>
                  <SelectItem value="exempted">Exempted</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="relative">
                <Button 
                  variant="outline" 
                  className="border-blue-200 text-blue-900 bg-white w-full sm:w-auto"
                  disabled={selectedStaff.length === 0}
                  onClick={() => setBulkActionDropdownOpen(!bulkActionDropdownOpen)}
                >
                  Bulk Actions {selectedStaff.length > 0 && `(${selectedStaff.length})`}
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
                {bulkActionDropdownOpen && selectedStaff.length > 0 && (
                  <div className="absolute top-full mt-1 right-0 w-40 bg-white border border-slate-200 shadow-lg rounded-md z-50 overflow-hidden">
                    <button 
                      onClick={() => {
                        setStaffToDelete(selectedStaff);
                        setBulkActionDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 text-red-600"
                    >
                      Delete Selected
                    </button>
                  </div>
                )}
              </div>

              <Button onClick={() => setIsAddModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Add Staff
              </Button>
            </div>

            <div className="rounded-md border overflow-hidden shadow-sm border-blue-100">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b-0">
                    <TableHead className="w-12 text-center bg-blue-900 border-r border-blue-800">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 cursor-pointer accent-blue-600"
                        checked={filteredData.length > 0 && selectedStaff.length === filteredData.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedStaff(filteredData.map(s => s.name));
                          } else {
                            setSelectedStaff([]);
                          }
                        }}
                      />
                    </TableHead>
                    <SortableHead label="Staff Name" sortKey="name" />
                    <SortableHead label="Onboarding (Start SY)" sortKey="onboardingYear" isSpecial />
                    <SortableHead label="Y1 (End SY)" sortKey="y1" />
                    <SortableHead label="Y2 (End SY)" sortKey="y2" />
                    <SortableHead label="Y3 (End SY)" sortKey="y3" />
                    <SortableHead label="Y4 (End SY)" sortKey="y4" />
                    <SortableHead label="Renewal (Start SY)" sortKey="renewal" />
                    <SortableHead label="Status" sortKey="status" />
                    <SortableHead label="Reimbursement" sortKey="reimbursement" />
                    <TableHead className="text-right bg-blue-900 text-white">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-neutral-500">
                        No staff found matching your filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredData.map((staff, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-center">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 cursor-pointer accent-blue-600"
                            checked={selectedStaff.includes(staff.name)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStaff(prev => [...prev, staff.name]);
                              } else {
                                setSelectedStaff(prev => prev.filter(n => n !== staff.name));
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-blue-950">{staff.name}</TableCell>
                        <TableCell className="bg-red-50/60 text-red-900 font-medium">
                          {staff.onboardingYear === 'exempted' ? '-' : staff.onboardingYear}
                        </TableCell>
                        <TableCell className={String(staff.y1) === 'exit' ? 'text-red-600 font-semibold' : ''}>{staff.y1 || '-'}</TableCell>
                        <TableCell className={String(staff.y2) === 'exit' ? 'text-red-600 font-semibold' : ''}>{staff.y2 || '-'}</TableCell>
                        <TableCell className={String(staff.y3) === 'exit' ? 'text-red-600 font-semibold' : ''}>{staff.y3 || '-'}</TableCell>
                        <TableCell className={String(staff.y4) === 'exit' ? 'text-red-600 font-semibold' : ''}>{staff.y4 || '-'}</TableCell>
                        <TableCell>{staff.renewal || '-'}</TableCell>
                        <TableCell>
                          <Badge className={
                            staff.status === 'Active' ? 'bg-blue-100 text-blue-800 hover:bg-blue-200 border-transparent' :
                            staff.status === 'Resigned' ? 'bg-red-50 text-red-900 hover:bg-red-100 border-red-200' : 
                            'bg-slate-100 text-slate-800 hover:bg-slate-200 border-transparent'
                          } variant="outline">
                            {staff.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium text-slate-700">
                          {staff.reimbursement !== null ? `S$ ${staff.reimbursement}` : '-'}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          {staff.isPendingExit ? (
                            <>
                              <button
                                onClick={() => handleSaveExit(staff.id!)}
                                className="text-sm font-medium text-emerald-600 hover:text-emerald-800 transition-colors"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => handleUndoExit(staff.id!)}
                                className="text-sm font-medium text-neutral-500 hover:text-neutral-700 transition-colors"
                              >
                                Undo
                              </button>
                            </>
                          ) : (
                            staff.status === 'Active' && (
                              <button
                                onClick={() => openExitModal(staff.id!)}
                                className="text-sm font-medium text-orange-600 hover:text-orange-800 transition-colors"
                              >
                                Tag Exit
                              </button>
                            )
                          )}
                          <button
                            onClick={() => setStaffToDelete([staff.name])}
                            className="text-sm font-medium text-red-600 hover:text-red-800 transition-colors"
                            title="Delete Record"
                          >
                            Delete
                          </button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </>
      )}
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle>Add New Staff</CardTitle>
                <CardDescription>Enter staff details to add to the directory.</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsAddModalOpen(false)} className="-mt-4 -mr-4">
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddStaff} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Staff Name</label>
                  <Input 
                    placeholder="e.g. Doe, John" 
                    value={newStaffName}
                    onChange={(e) => setNewStaffName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Onboarding Start SY</label>
                  <Input 
                    placeholder="e.g. 2026 or 'exempted'" 
                    value={newStaffYear}
                    onChange={(e) => setNewStaffYear(e.target.value)}
                    required
                  />
                </div>
                <div className="pt-4 flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">Add Staff</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {staffToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-red-600">Delete Staff Record</CardTitle>
                <CardDescription>This action cannot be undone.</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setStaffToDelete(null)} className="-mt-4 -mr-4">
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <p className="mb-6 text-slate-700">
                Are you sure you want to delete {staffToDelete?.length === 1 ? (
                  <>the record for <strong className="text-slate-900">{staffToDelete[0]}</strong></>
                ) : (
                  <><strong className="text-slate-900">{staffToDelete?.length}</strong> selected records</>
                )}?
              </p>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setStaffToDelete(null)}>Cancel</Button>
                <Button variant="destructive" className="bg-red-600 hover:bg-red-700 text-white" onClick={confirmDelete}>
                  Delete Record
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {exitModalStaff && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle>Tag Exit</CardTitle>
                <CardDescription>
                  Select the exit year for <strong>{exitModalStaff.name}</strong>
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setExitModalStaffId(null)} className="-mt-4 -mr-4">
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Exit Year</label>
                  <Select value={selectedExitColumn} onValueChange={setSelectedExitColumn}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select which year to exit..." />
                    </SelectTrigger>
                    <SelectContent>
                      {getExitOptions(exitModalStaff).map(opt => (
                        <SelectItem key={opt.column} value={opt.column}>
                          {opt.label} — S$ {opt.reimbursement.toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedExitColumn && (
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <p className="text-sm font-medium text-red-800">Reimbursement Fee</p>
                    <p className="text-2xl font-bold text-red-600">
                      S$ {getExitOptions(exitModalStaff).find(o => o.column === selectedExitColumn)?.reimbursement.toLocaleString()}
                    </p>
                  </div>
                )}

                <div className="pt-4 flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setExitModalStaffId(null)}>Cancel</Button>
                  <Button
                    className="bg-red-600 hover:bg-red-700 text-white"
                    disabled={!selectedExitColumn}
                    onClick={handleConfirmExit}
                  >
                    Tag Exit
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
