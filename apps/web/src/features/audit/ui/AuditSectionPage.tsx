import { useEffect, useMemo, useState } from 'react';
import { Accordion, Button, Form } from 'react-bootstrap';
import { useParams } from 'react-router-dom';

import { useAuditLogs } from '../hooks/useAudit';
import { AUDIT_PAGE_SIZE } from '../model/types';
import { labelAuditAction, labelAuditEntity } from '../model/labels';
import { getAuditSection } from '../model/sections';
import { AuditLogList } from './AuditLogList';

/** Sección de auditoría con filtros en acordeón. */
export function AuditSectionPage() {
  const { sectionId = '' } = useParams<{ sectionId: string }>();
  const section = getAuditSection(sectionId);

  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!section) return;
    setAction('');
    setEntityType(section.defaultEntityType);
    setPage(1);
  }, [section]);

  useEffect(() => {
    setPage(1);
  }, [action, entityType]);

  const params = useMemo(
    () => ({
      action: action || undefined,
      entityType: entityType || undefined,
      limit: AUDIT_PAGE_SIZE,
      page,
    }),
    [action, entityType, page],
  );

  const { data, isLoading, isError, error, refetch, isFetching } = useAuditLogs(params);

  if (!section) {
    return null;
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 0;
  const currentPage = data?.page ?? page;

  const hasActiveFilters =
    Boolean(action) || entityType !== section.defaultEntityType;

  return (
    <div className="ca-audit-section">
      <header className="ca-audit-section__head">
        <div>
          <h2 className="ca-audit-section__title">{section.label}</h2>
          <p className="ca-audit-section__lead">{section.lead}</p>
        </div>
      </header>

      <Accordion className="ca-audit-filters" defaultActiveKey="">
        <Accordion.Item eventKey="filters" className="ca-audit-filters__item">
          <Accordion.Header>Filtros</Accordion.Header>
          <Accordion.Body>
            <Form
              className="ca-audit-filters__form"
              onSubmit={(e) => {
                e.preventDefault();
                void refetch();
              }}
            >
              {section.entityTypes.length > 0 ? (
                <Form.Group>
                  <Form.Label>Tipo de registro</Form.Label>
                  <Form.Select
                    size="sm"
                    value={entityType}
                    onChange={(e) => setEntityType(e.target.value)}
                    aria-label="Filtrar por tipo de registro"
                  >
                    {section.entityTypes.map((opt) => (
                      <option key={opt} value={opt}>
                        {labelAuditEntity(opt)}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              ) : null}

              {section.actionCodes.length > 0 ? (
                <Form.Group>
                  <Form.Label>Acción</Form.Label>
                  <Form.Select
                    size="sm"
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    aria-label="Filtrar por acción"
                  >
                    <option value="">Todas las acciones</option>
                    {section.actionCodes.map((opt) => (
                      <option key={opt} value={opt}>
                        {labelAuditAction(opt)}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              ) : null}

              <div className="ca-audit-filters__actions">
                <Button
                  type="button"
                  size="sm"
                  variant="outline-secondary"
                  onClick={() => void refetch()}
                  disabled={isFetching}
                >
                  Actualizar
                </Button>
                {hasActiveFilters ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="link"
                    className="ca-audit-filters__clear"
                    onClick={() => {
                      setAction('');
                      setEntityType(section.defaultEntityType);
                    }}
                  >
                    Limpiar filtros
                  </Button>
                ) : null}
              </div>
            </Form>
          </Accordion.Body>
        </Accordion.Item>
      </Accordion>

      <AuditLogList
        items={items}
        isLoading={isLoading}
        isError={isError}
        error={error}
        isFetching={isFetching}
        total={total}
        totalPages={totalPages}
        currentPage={currentPage}
        onPageChange={setPage}
      />
    </div>
  );
}
