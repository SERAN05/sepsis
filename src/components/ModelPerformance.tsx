import React, { useState } from 'react';
import { ExcelProcessor } from '../utils/excelProcessor';
import { EnhancedSepsisMLModel } from '../utils/enhancedMLModel';
import { DatasetRow } from '../types/dataset';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export const ModelPerformance: React.FC = () => {
  const [trainData, setTrainData] = useState<DatasetRow[]>([]);
  const [testData, setTestData] = useState<DatasetRow[]>([]);
  const [model, setModel] = useState<EnhancedSepsisMLModel | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'train' | 'test') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const { data } = await ExcelProcessor.processExcelFile(file);
      if (type === 'train') {
        setTrainData(data);
      } else {
        setTestData(data);
      }
    } finally {
      setLoading(false);
    }
  };

  // Train model when trainData changes
  React.useEffect(() => {
    if (trainData.length > 0) {
      const m = new EnhancedSepsisMLModel();
      m.trainModelInBackground(trainData).then(() => setModel(m));
    }
  }, [trainData]);

  // Predict and compare when both model and testData are available
  React.useEffect(() => {
    let cancelled = false;
    async function predictIncrementally() {
      if (model && testData.length > 0) {
        setChartData([]);
        setProgress(0);
        const groupSize = 25;
        let aggregatedData: any[] = [];
        for (let groupStart = 0; groupStart < testData.length; groupStart += groupSize) {
          if (cancelled) break;
          let groupPredicted = 0;
          let groupActual = 0;
          let groupCount = 0;
          for (let idx = groupStart; idx < Math.min(groupStart + groupSize, testData.length); idx++) {
            const row = testData[idx];
            const prediction = model.predictWithUncertainty(row);
            groupPredicted += prediction.probability * 100;
            groupActual += Number(row.SepsisLabel || 0) * 100;
            groupCount++;
          }
          aggregatedData.push({
            x: Math.floor(groupStart / groupSize) + 1,
            predicted: groupPredicted / groupCount,
            actual: groupActual / groupCount,
          });
          setChartData([...aggregatedData]);
          setProgress(Math.round((Math.min(groupStart + groupSize, testData.length) / testData.length) * 100));
          // No artificial delay for speed
        }
      }
    }
    predictIncrementally();
    return () => { cancelled = true; };
  }, [model, testData]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block font-medium mb-2">Upload Training Data (with known sepsis labels):</label>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={e => handleUpload(e, 'train')} />
        </div>
        <div>
          <label className="block font-medium mb-2">Upload Test Data (with or without sepsis labels):</label>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={e => handleUpload(e, 'test')} />
        </div>
      </div>
      {loading && <div className="text-center text-primary-600">Processing...</div>}
      {progress > 0 && progress < 100 && (
        <div className="text-center text-primary-700">Predicting... {progress}%</div>
      )}
      {chartData.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Predicted vs Actual Sepsis Probability (Per Patient)</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="x" stroke="#6b7280" fontSize={12} label={{ value: 'Patient Group (25s)', position: 'insideBottom', offset: -5 }} />
                <YAxis stroke="#6b7280" fontSize={12} label={{ value: 'Sepsis Probability (%)', angle: -90, position: 'insideLeft' }} domain={[0, 100]} />
                <Tooltip formatter={(value: any, name: string) => [`${value.toFixed(1)}%`, name === 'predicted' ? 'Predicted Sepsis' : 'Actual Sepsis']} />
                <Line type="monotone" dataKey="predicted" stroke="#3b82f6" strokeWidth={3} name="Predicted Sepsis" dot={false} />
                <Line type="monotone" dataKey="actual" stroke="#dc2626" strokeWidth={2} name="Actual Sepsis" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex items-center justify-center space-x-6 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-1 bg-primary-500 rounded"></div>
              <span className="text-gray-600">Predicted Sepsis</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-1 bg-danger-500 rounded"></div>
              <span className="text-gray-600">Actual Sepsis</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};