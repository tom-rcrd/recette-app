-- Corrections du catalogue de départ
-- Les tomates concassées (conserve) sont un légume : elles comptent dans « Riche en légumes » / « Peu de légumes »
update ingredients set category = 'legume' where name = 'Tomates concassées' and category = 'extra';
