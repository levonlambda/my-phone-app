import PropTypes from 'prop-types';
import { X, Tag, Edit, Image as ImageIcon } from 'lucide-react';

const SpecRow = ({ label, value }) => (
  <div className="flex items-start py-0.5">
    <p className="text-[rgb(52,69,157)] w-32 text-sm flex-shrink-0">{label}:</p>
    <p className="text-sm flex-1">{value || '-'}</p>
  </div>
);

SpecRow.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.node
};

const AccessoryProductDetailModal = ({ isOpen, product, onClose, onEdit }) => {
  if (!isOpen || !product) return null;

  const tags = Array.isArray(product.tags) ? product.tags : [];

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-[rgb(52,69,157)]">
            {product.manufacturer} {product.model}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Image */}
          <div className="flex justify-center">
            {product.photoUrl ? (
              <img
                src={product.photoUrl}
                alt={product.model}
                className="max-w-full max-h-64 object-contain border rounded bg-gray-50"
              />
            ) : (
              <div className="w-64 h-48 bg-gray-50 border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center text-gray-400">
                <ImageIcon className="h-10 w-10 mb-2" />
                <span className="text-sm">No Image</span>
              </div>
            )}
          </div>

          {/* Identifiers */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-[rgb(52,69,157)]">Identifiers</h3>
            </div>
            <div className="ml-1">
              <SpecRow label="Internal SKU" value={<span className="font-mono">{product.internalSku || product.id}</span>} />
              <SpecRow label="Barcode" value={product.barcode ? <span className="font-mono">{product.barcode}</span> : '-'} />
              <SpecRow label="Status" value={
                product.active === false ? (
                  <span className="inline-block px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-xs">Inactive</span>
                ) : (
                  <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">Active</span>
                )
              } />
            </div>
          </div>

          {/* Details */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-[rgb(52,69,157)]">Details</h3>
            </div>
            <div className="ml-1">
              <SpecRow label="Category" value={product.category} />
              <SpecRow label="Manufacturer" value={product.manufacturer} />
              <SpecRow label="Model" value={product.model} />
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-[rgb(52,69,157)]" />
              <h3 className="text-lg font-semibold">Tags</h3>
            </div>
            <div className="ml-7 flex flex-wrap gap-2">
              {tags.length > 0 ? (
                tags.map((t, i) => (
                  <span key={`${t}-${i}`} className="inline-block px-2 py-1 text-xs bg-gray-100 rounded-full">
                    {t}
                  </span>
                ))
              ) : (
                <span className="text-sm text-gray-500">-</span>
              )}
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-[rgb(52,69,157)]">Description</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap ml-1">{product.description}</p>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t p-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(product)}
              className="flex items-center gap-1 px-4 py-2 bg-[rgb(52,69,157)] text-white rounded hover:bg-[rgb(52,69,157)]/90"
            >
              <Edit className="h-4 w-4" />
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

AccessoryProductDetailModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  product: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onEdit: PropTypes.func
};

export default AccessoryProductDetailModal;
