import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Diamond, Plus } from 'lucide-react';
import goldenData from '../../dataset_golden_ground_truth.json';
import resultsData from '../../dataset_batch_review_results.json';

const DATASETS = [
  {
    id: 'golden-ground-truth',
    name: 'Golden Dataset — Ground Truth',
    description: 'Golden Dataset — Ground Truth',
    data: goldenData,
  },
  {
    id: 'batch-review-results',
    name: 'Batch Review Results',
    description: 'Batch Review Results',
    data: resultsData,
  },
];

export default function DataPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-end px-6 py-2.5 border-b border-[#f0f0f0]">
        <button className="flex items-center gap-1.5 bg-[#171717] text-white text-[12px] font-[550] px-3 py-1.5 rounded-lg hover:bg-[#333] transition-colors">
          <Plus className="w-3.5 h-3.5" />
          Create dataset
        </button>
      </div>

      {/* Column headers */}
      <div className="flex items-center px-6 py-2.5 border-b border-[#f0f0f0]">
        <div className="flex-1 text-[12px] font-[550] text-[#8f8f8f]">Datasets</div>
        <div className="flex-1 text-[12px] font-[550] text-[#8f8f8f]">Description</div>
      </div>

      {/* Dataset rows */}
      <div>
        {DATASETS.map((ds) => (
          <button
            key={ds.id}
            onClick={() => navigate(`/data/dataset/${ds.id}`)}
            className="w-full flex items-center px-6 py-4 border-b border-[#f0f0f0] hover:bg-[#fafafa] transition-colors text-left"
          >
            <div className="flex-1 flex items-center gap-3">
              <Diamond className="w-4 h-4 text-[#8f8f8f] flex-shrink-0" strokeWidth={1.5} />
              <span className="text-[13px] font-[550] text-[#171717]">{ds.name}</span>
            </div>
            <div className="flex-1">
              <span className="text-[13px] text-[#383838]">{ds.description}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
