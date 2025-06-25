import React, { useState, useEffect } from 'react';
import { Upload, FileText, BarChart3, TrendingUp, AlertCircle, CheckCircle, Loader, Download } from 'lucide-react';
import { ExcelProcessor } from '../utils/excelProcessor';
import { EnhancedSepsisMLModel } from '../utils/enhancedMLModel';
import { DatasetRow, ModelMetrics } from '../types/dataset';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface ModelPerformanceProps {
  metrics?: ModelMetrics | null;
}

export const ModelPerformance: React.FC<ModelPerformanceProps> = ({ metrics: externalMetrics }) => {
  const [trainingData, setTrainingData] = useState<DatasetRow[]>([]);
  const [testData, setTestData] = useState<DatasetRow[]>([]);
  const [model, setModel] = useState<EnhancedSepsisMLModel | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [modelMetrics, setModelMetrics] = useState<ModelMetrics | null>(externalMetrics || null);
  const [uploadStatus, setUploadStatus] = useState<{
    training: 'idle' | 'uploading' | 'success' | 'error';
    test: 'idle' | 'uploading' | 'success' | 'error';
  }>({ training: 'idle', test: 'idle' });
  const [errorMessages, setErrorMessages] = useState<{ training?: string; test?: string }>({});

  const handleFileUpload = async (file: File, type: 'training' | 'test') => {
    setUploadStatus(prev => ({ ...prev, [type]: 'uploading' }));
    setErrorMessages(prev => ({ ...prev, [type]: undefined }));
    
    try {
      const { data } = await ExcelProcessor.processExcelFile(file);
      
      if (type === 'training') {
        // Validate training data has sepsis labels
        const hasSepsisLabel = data.some(row => 
          row.SepsisLabel !== undefined || 
          row.sepsislabel !== undefined || 
          Object.keys(row).some(key => key.toLowerCase().includes('sepsis'))
        );
        
        if (!hasSepsisLabel) {
          throw new Error('Training data must contain sepsis labels (SepsisLabel column)');
        }
        
        setTrainingData(data);
      } else {
        setTestData(data);
      }
      
      setUploadStatus(prev => ({ ...prev, [type]: 'success' }));
    } catch (error) {
      console.error(`Error uploading ${type} data:`, error);
      setErrorMessages(prev => ({ ...prev, [type]: (error as Error).message }));
      setUploadStatus(prev => ({ ...prev, [type]: 'error' }));
    }
  };

  // Train model when training data is uploaded
  useEffect(() => {
    if (trainingData.length > 0 && !model) {
      const trainModel = async () => {
        setLoading(true);
        try {
          const newModel = new EnhancedSepsisMLModel();
          const metrics = await newModel.trainModelInBackground(trainingData);
          setModel(newModel);
          setModelMetrics(metrics);
        } catch (error) {
          console.error('Model training failed:', error);
        } finally {
          setLoading(false);
        }
      };
      trainModel();
    }
  }, [trainingData]);

  // Generate predictions and comparison when both model and test data are available
  useEffect(() => {
    let cancelled = false;
    
    const generatePredictions = async () => {
      if (model && testData.length > 0 && trainingData.length > 0) {
        setLoading(true);
        setProgress(0);
        setChartData([]);
        
        try {
          // Group test data by patient
          const patientGroups = testData.reduce((groups, row) => {
            const patientId = String(row.Patient_ID || row.PatientID || row.patient_id || '');
            if (!groups[patientId]) groups[patientId] = [];
            groups[patientId].push(row);
            return groups;
          }, {} as { [key: string]: DatasetRow[] });

          const patients = Object.keys(patientGroups);
          const aggregatedData: any[] = [];
          
          for (let i = 0; i < patients.length; i++) {
            if (cancelled) break;
            
            const patientId = patients[i];
            const patientData = patientGroups[patientId];
            
            // Get the latest data point for this patient
            const latestData = patientData[patientData.length - 1];
            
            // Get prediction from model
            const prediction = model.predictWithUncertainty(latestData);
            
            // Get actual sepsis status from training data for this patient
            const actualData = trainingData.find(row => 
              String(row.Patient_ID || row.PatientID || row.patient_id || '') === patientId
            );
            const actualSepsis = actualData ? Number(actualData.SepsisLabel || actualData.sepsislabel || 0) : 0;
            
            aggregatedData.push({
              patientIndex: i + 1,
              patientId,
              predicted: prediction.probability * 100,
              actual: actualSepsis * 100,
              confidence: prediction.confidence * 100,
              riskLevel: prediction.riskLevel
            });
            
            setChartData([...aggregatedData]);
            setProgress(Math.round(((i + 1) / patients.length) * 100));
            
            // Small delay to show progress
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        } catch (error) {
          console.error('Prediction generation failed:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    generatePredictions();
    
    return () => {
      cancelled = true;
    };
  }, [model, testData, trainingData]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-5 h-5 text-success-600" />;
      case 'error': return <AlertCircle className="w-5 h-5 text-danger-600" />;
      case 'uploading': return <Loader className="w-5 h-5 text-primary-600 animate-spin" />;
      default: return <Upload className="w-5 h-5 text-gray-400" />;
    }
  };

  const calculateAccuracyMetrics = () => {
    if (chartData.length === 0) return null;
    
    const threshold = 50; // 50% threshold for sepsis classification
    let truePositives = 0;
    let trueNegatives = 0;
    let falsePositives = 0;
    let falseNegatives = 0;
    
    chartData.forEach(point => {
      const predictedPositive = point.predicted >= threshold;
      const actualPositive = point.actual >= threshold;
      
      if (predictedPositive && actualPositive) truePositives++;
      else if (!predictedPositive && !actualPositive) trueNegatives++;
      else if (predictedPositive && !actualPositive) falsePositives++;
      else if (!predictedPositive && actualPositive) falseNegatives++;
    });
    
    const accuracy = (truePositives + trueNegatives) / chartData.length;
    const precision = truePositives / (truePositives + falsePositives) || 0;
    const recall = truePositives / (truePositives + falseNegatives) || 0;
    const f1Score = 2 * (precision * recall) / (precision + recall) || 0;
    
    return { accuracy, precision, recall, f1Score, truePositives, trueNegatives, falsePositives, falseNegatives };
  };

  const accuracyMetrics = calculateAccuracyMetrics();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-white/20 rounded-lg">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Model Performance Analysis</h2>
            <p className="text-blue-100">Compare predicted vs actual sepsis outcomes</p>
          </div>
        </div>
      </div>

      {/* File Upload Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Training Data Upload */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <FileText className="w-5 h-5 text-primary-600" />
            <h3 className="text-lg font-semibold text-gray-900">Training Data</h3>
            {getStatusIcon(uploadStatus.training)}
          </div>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary-400 transition-colors">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file, 'training');
              }}
              className="hidden"
              id="training-upload"
            />
            <label htmlFor="training-upload" className="cursor-pointer">
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <div className="text-sm font-medium text-primary-600">Upload Training Dataset</div>
              <div className="text-xs text-gray-500 mt-1">Must include sepsis labels</div>
            </label>
          </div>
          
          {errorMessages.training && (
            <div className="mt-3 p-3 bg-danger-50 border border-danger-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-danger-600" />
                <span className="text-sm text-danger-800">{errorMessages.training}</span>
              </div>
            </div>
          )}
          
          {trainingData.length > 0 && (
            <div className="mt-3 p-3 bg-success-50 border border-success-200 rounded-lg">
              <div className="text-sm text-success-800">
                ✓ {trainingData.length.toLocaleString()} records loaded
              </div>
            </div>
          )}
        </div>

        {/* Test Data Upload */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <FileText className="w-5 h-5 text-orange-600" />
            <h3 className="text-lg font-semibold text-gray-900">Test Data</h3>
            {getStatusIcon(uploadStatus.test)}
          </div>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-orange-400 transition-colors">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file, 'test');
              }}
              className="hidden"
              id="test-upload"
            />
            <label htmlFor="test-upload" className="cursor-pointer">
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <div className="text-sm font-medium text-orange-600">Upload Test Dataset</div>
              <div className="text-xs text-gray-500 mt-1">Patient data without labels</div>
            </label>
          </div>
          
          {errorMessages.test && (
            <div className="mt-3 p-3 bg-danger-50 border border-danger-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-danger-600" />
                <span className="text-sm text-danger-800">{errorMessages.test}</span>
              </div>
            </div>
          )}
          
          {testData.length > 0 && (
            <div className="mt-3 p-3 bg-success-50 border border-success-200 rounded-lg">
              <div className="text-sm text-success-800">
                ✓ {testData.length.toLocaleString()} records loaded
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Progress Indicator */}
      {loading && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Loader className="w-5 h-5 text-primary-600 animate-spin" />
            <span className="font-medium text-gray-900">
              {trainingData.length > 0 && !model ? 'Training model...' : 'Generating predictions...'}
            </span>
          </div>
          {progress > 0 && (
            <div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-sm text-gray-600 mt-1">{progress}% complete</div>
            </div>
          )}
        </div>
      )}

      {/* Accuracy Metrics */}
      {accuracyMetrics && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Model Accuracy Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-primary-50 rounded-lg">
              <div className="text-sm font-medium text-primary-800">Accuracy</div>
              <div className="text-2xl font-bold text-primary-900">
                {(accuracyMetrics.accuracy * 100).toFixed(1)}%
              </div>
            </div>
            <div className="p-4 bg-success-50 rounded-lg">
              <div className="text-sm font-medium text-success-800">Precision</div>
              <div className="text-2xl font-bold text-success-900">
                {(accuracyMetrics.precision * 100).toFixed(1)}%
              </div>
            </div>
            <div className="p-4 bg-warning-50 rounded-lg">
              <div className="text-sm font-medium text-warning-800">Recall</div>
              <div className="text-2xl font-bold text-warning-900">
                {(accuracyMetrics.recall * 100).toFixed(1)}%
              </div>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="text-sm font-medium text-purple-800">F1-Score</div>
              <div className="text-2xl font-bold text-purple-900">
                {(accuracyMetrics.f1Score * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comparison Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Predicted vs Actual Sepsis Comparison</h3>
              <p className="text-sm text-gray-600">Comparing model predictions with actual sepsis outcomes</p>
            </div>
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-1 bg-danger-500 rounded"></div>
                <span className="text-gray-600">Actual Sepsis</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-1 bg-primary-500 rounded"></div>
                <span className="text-gray-600">Predicted Sepsis</span>
              </div>
            </div>
          </div>
          
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="patientIndex" 
                  stroke="#6b7280" 
                  fontSize={12}
                  label={{ value: 'Patient Index', position: 'insideBottom', offset: -10 }}
                />
                <YAxis 
                  stroke="#6b7280" 
                  fontSize={12}
                  label={{ value: 'Sepsis Probability (%)', angle: -90, position: 'insideLeft' }}
                  domain={[0, 100]}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                  formatter={(value: any, name: string, props: any) => {
                    const data = props.payload;
                    if (name === 'predicted') {
                      return [
                        <div key="predicted">
                          <div>{value.toFixed(1)}% (Predicted)</div>
                          <div className="text-xs text-gray-500">
                            Risk: {data.riskLevel} | Confidence: {data.confidence.toFixed(1)}%
                          </div>
                        </div>,
                        'Predicted Sepsis'
                      ];
                    }
                    return [`${value.toFixed(1)}%`, 'Actual Sepsis'];
                  }}
                  labelFormatter={(label, payload) => {
                    if (payload && payload.length > 0) {
                      return `Patient: ${payload[0].payload.patientId}`;
                    }
                    return `Patient Index: ${label}`;
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="actual" 
                  stroke="#dc2626" 
                  strokeWidth={3}
                  name="Actual Sepsis"
                  dot={{ fill: '#dc2626', strokeWidth: 2, r: 3 }}
                  connectNulls={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="predicted" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  strokeDasharray="5 5"
                  name="Predicted Sepsis"
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 3 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-700">
              <strong>Analysis:</strong> This chart compares the model's sepsis probability predictions against actual sepsis outcomes. 
              The closer the lines align, the better the model's predictive accuracy. Divergences indicate areas where the model 
              may need improvement or where additional clinical factors should be considered.
            </div>
          </div>
        </div>
      )}

      {/* Confusion Matrix */}
      {accuracyMetrics && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Confusion Matrix</h3>
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div className="p-4 bg-success-50 border-2 border-success-200 rounded-lg text-center">
              <div className="text-sm font-medium text-success-800">True Negatives</div>
              <div className="text-2xl font-bold text-success-900">{accuracyMetrics.trueNegatives}</div>
              <div className="text-xs text-success-700">Correctly identified non-sepsis</div>
            </div>
            <div className="p-4 bg-warning-50 border-2 border-warning-200 rounded-lg text-center">
              <div className="text-sm font-medium text-warning-800">False Positives</div>
              <div className="text-2xl font-bold text-warning-900">{accuracyMetrics.falsePositives}</div>
              <div className="text-xs text-warning-700">Incorrectly flagged as sepsis</div>
            </div>
            <div className="p-4 bg-danger-50 border-2 border-danger-200 rounded-lg text-center">
              <div className="text-sm font-medium text-danger-800">False Negatives</div>
              <div className="text-2xl font-bold text-danger-900">{accuracyMetrics.falseNegatives}</div>
              <div className="text-xs text-danger-700">Missed sepsis cases</div>
            </div>
            <div className="p-4 bg-primary-50 border-2 border-primary-200 rounded-lg text-center">
              <div className="text-sm font-medium text-primary-800">True Positives</div>
              <div className="text-2xl font-bold text-primary-900">{accuracyMetrics.truePositives}</div>
              <div className="text-xs text-primary-700">Correctly identified sepsis</div>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      {trainingData.length === 0 && testData.length === 0 && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
          <div className="flex items-center space-x-3">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <div>
              <h4 className="font-medium text-blue-900">How to Use Model Performance Analysis</h4>
              <div className="text-sm text-blue-700 mt-2 space-y-1">
                <p>1. <strong>Upload Training Data:</strong> Dataset with known sepsis outcomes (SepsisLabel column required)</p>
                <p>2. <strong>Upload Test Data:</strong> Patient data without sepsis labels for prediction</p>
                <p>3. <strong>View Results:</strong> Compare predicted vs actual sepsis probabilities in the generated chart</p>
                <p>4. <strong>Analyze Performance:</strong> Review accuracy metrics and confusion matrix</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};